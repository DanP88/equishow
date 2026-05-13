// calculate-route-price — Supabase Edge Function (durcie P22)
//
// Calcule la distance routière propriétaire → locataire → concours via OpenRouteService.
// La clé ORS ne sort jamais côté client.
//
// Audit P22 :
//  - JWT obligatoire (verifyJWT=true côté supabase + recheck explicite).
//  - `transportId` obligatoire : on charge `price_per_km` + adresses owner/destination
//    depuis la DB (anti-fraud — plus de prix client-side).
//  - Le client ne peut plus injecter un pricePerKm arbitraire.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const ORS_BASE = "https://api.openrouteservice.org";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeoPoint {
  lat: number;
  lng: number;
  address?: string;
}

interface RouteSegment {
  distanceM: number;
  durationS: number;
}

interface RoutePricingResult {
  distanceOwnerToPickupKm: number;
  distancePickupToDestinationKm: number;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  pricePerKm: number;
  totalPrice: number;
  provider: "openrouteservice";
  pickupSource: "manual" | "geolocation";
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  ownerAddress?: string;
  destinationAddress?: string;
  routeSnapshotJson: unknown;
}

// ─── Geocoding (ORS) ──────────────────────────────────────────────────────────

async function geocodeAddress(address: string, apiKey: string): Promise<GeoPoint> {
  const url =
    `${ORS_BASE}/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(address)}&lang=fr&size=1&boundary.country=FR`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`ORS geocoding error ${resp.status}`);
  }
  const json = await resp.json();
  const feature = json.features?.[0];
  if (!feature) {
    throw new Error(`ADDR_NOT_FOUND:${address}`);
  }
  const [lng, lat] = feature.geometry.coordinates as [number, number];
  return { lat, lng, address: feature.properties.label as string };
}

// ─── Directions (ORS) ─────────────────────────────────────────────────────────

async function calculateRoute(
  points: [number, number][],
  apiKey: string,
): Promise<{ segments: RouteSegment[]; raw: unknown }> {
  const url = `${ORS_BASE}/v2/directions/driving-car/json`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json, application/geo+json",
    },
    body: JSON.stringify({ coordinates: points }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`ORS directions error ${resp.status}: ${errText}`);
  }
  const json = await resp.json();
  const route = (json as any).routes?.[0];
  if (!route) throw new Error("ORS returned no route");
  const segments: RouteSegment[] = ((route.segments as any[]) ?? []).map((seg: any) => ({
    distanceM: seg.distance as number,
    durationS: seg.duration as number,
  }));
  return { segments, raw: json };
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}
function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("OPENROUTESERVICE_API_KEY") ?? "";
  const featureEnabled = Deno.env.get("ENABLE_ROUTE_PRICING") === "true";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!featureEnabled) {
    return jsonError(503, "Route pricing est désactivé.");
  }
  if (!apiKey) {
    console.error("OPENROUTESERVICE_API_KEY non configurée");
    return jsonError(500, "Impossible de calculer le trajet pour le moment.");
  }
  if (!supabaseUrl || !anonKey) {
    console.error("SUPABASE_URL ou SUPABASE_ANON_KEY non configurées");
    return jsonError(500, "Impossible de calculer le trajet pour le moment.");
  }

  // ── AuthN obligatoire ────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "Authentification requise.");
  }
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonError(401, "Token invalide.");
  }

  try {
    const body = await req.json();
    const {
      transportId,
      pickupSource,
      pickupAddress: rawPickupAddress,
      pickupLat,
      pickupLng,
    } = body as Record<string, unknown>;

    // ── Validate transportId (anti-fraud : pricePerKm vient de la DB) ───────
    if (typeof transportId !== "string" || !transportId.trim()) {
      return jsonError(400, "transportId manquant.");
    }

    // ── Validate pickupSource ───────────────────────────────────────────────
    if (pickupSource !== "manual" && pickupSource !== "geolocation") {
      return jsonError(400, 'pickupSource doit être "manual" ou "geolocation".');
    }

    // ── Load annonce server-side (RLS : tout authentifié peut voir) ────────
    const { data: annonce, error: annonceErr } = await supabase
      .from("transport_annonces")
      .select("id, price_per_km, aller_retour, adresse_van, ville_depart, adresse_arrivee, ville_arrivee, start_lat, start_lng, destination_lat, destination_lng")
      .eq("id", transportId)
      .maybeSingle();

    if (annonceErr || !annonce) {
      return jsonError(404, "Annonce introuvable.");
    }
    const pricePerKm = Number(annonce.price_per_km);
    if (!Number.isFinite(pricePerKm) || pricePerKm <= 0) {
      return jsonError(400, "L'annonce n'a pas de prix au km valide.");
    }

    // ── Resolve owner point ───
    const ownerAddress = (annonce.adresse_van ?? annonce.ville_depart ?? "").toString();
    let owner: GeoPoint;
    if (isValidLatLng(annonce.start_lat, annonce.start_lng)) {
      owner = {
        lat: annonce.start_lat as number,
        lng: annonce.start_lng as number,
        address: ownerAddress || undefined,
      };
    } else if (ownerAddress.trim()) {
      owner = await geocodeAddress(ownerAddress.trim(), apiKey);
    } else {
      return jsonError(400, "L'annonce ne contient pas toutes les informations nécessaires.");
    }

    // ── Resolve pickup point (saisi côté client — c'est la position du cavalier) ──
    let pickup: GeoPoint;
    if (pickupSource === "geolocation") {
      if (!isValidLatLng(pickupLat, pickupLng)) {
        return jsonError(400, "Coordonnées de géolocalisation invalides.");
      }
      pickup = { lat: pickupLat as number, lng: pickupLng as number };
    } else {
      if (typeof rawPickupAddress !== "string" || !rawPickupAddress.trim()) {
        return jsonError(400, "Adresse vide.");
      }
      pickup = await geocodeAddress(rawPickupAddress.trim(), apiKey);
    }

    // ── Resolve destination point ───
    const destinationAddress = (annonce.adresse_arrivee ?? annonce.ville_arrivee ?? "").toString();
    let destination: GeoPoint;
    if (isValidLatLng(annonce.destination_lat, annonce.destination_lng)) {
      destination = {
        lat: annonce.destination_lat as number,
        lng: annonce.destination_lng as number,
        address: destinationAddress || undefined,
      };
    } else if (destinationAddress.trim()) {
      destination = await geocodeAddress(destinationAddress.trim(), apiKey);
    } else {
      return jsonError(400, "L'annonce ne contient pas toutes les informations nécessaires.");
    }

    // ── Calculate route: owner → pickup → destination ───
    const { segments, raw } = await calculateRoute(
      [
        [owner.lng, owner.lat],
        [pickup.lng, pickup.lat],
        [destination.lng, destination.lat],
      ],
      apiKey,
    );

    if (segments.length < 2) {
      throw new Error("Impossible de calculer le trajet pour le moment.");
    }

    const seg1 = segments[0];
    const seg2 = segments[1];

    const distOwnerToPickupKm = round1(seg1.distanceM / 1000);
    const distPickupToDestKm = round1(seg2.distanceM / 1000);
    const oneWayKm = distOwnerToPickupKm + distPickupToDestKm;
    // Aller-retour : on facture le trajet 2 fois (anti-fraud server-side).
    const isAllerRetour = annonce.aller_retour === true;
    const tripMultiplier = isAllerRetour ? 2 : 1;
    const totalDistKm = round1(oneWayKm * tripMultiplier);
    const totalDurationMin = Math.round(((seg1.durationS + seg2.durationS) * tripMultiplier) / 60);
    const totalPrice = round2(totalDistKm * pricePerKm);

    const result: RoutePricingResult = {
      distanceOwnerToPickupKm: distOwnerToPickupKm,
      distancePickupToDestinationKm: distPickupToDestKm,
      totalDistanceKm: totalDistKm,
      estimatedDurationMinutes: totalDurationMin,
      pricePerKm,
      totalPrice,
      provider: "openrouteservice",
      pickupSource: pickupSource as "manual" | "geolocation",
      pickupAddress: pickup.address ?? (rawPickupAddress as string) ?? "",
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      ownerAddress: owner.address,
      destinationAddress: destination.address,
      routeSnapshotJson: raw,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inattendue";
    console.error("calculate-route-price:", msg);

    let userMessage = "Impossible de calculer le trajet pour le moment.";
    if (msg.startsWith("ADDR_NOT_FOUND:")) {
      userMessage = "Adresse introuvable, vérifiez votre saisie.";
    } else if (msg.includes("nécessaires")) {
      userMessage = "L'annonce ne contient pas toutes les informations nécessaires.";
    } else if (msg.includes("invalides") || msg.includes("invalide")) {
      userMessage = "Coordonnées de géolocalisation invalides.";
    }

    return new Response(JSON.stringify({ error: userMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
