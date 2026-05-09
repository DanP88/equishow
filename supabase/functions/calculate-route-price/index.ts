// calculate-route-price — Supabase Edge Function
// Calcule la distance routière propriétaire → locataire → concours via OpenRouteService.
// La clé ORS ne sort jamais côté client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("OPENROUTESERVICE_API_KEY") ?? "";
  const featureEnabled = Deno.env.get("ENABLE_ROUTE_PRICING") === "true";

  if (!featureEnabled) {
    return new Response(
      JSON.stringify({ error: "Route pricing est désactivé." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!apiKey) {
    console.error("OPENROUTESERVICE_API_KEY non configurée");
    return new Response(
      JSON.stringify({ error: "Impossible de calculer le trajet pour le moment." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json();
    const {
      pickupSource,
      pickupAddress: rawPickupAddress,
      pickupLat,
      pickupLng,
      ownerAddress,
      ownerLat,
      ownerLng,
      destinationAddress,
      destinationLat,
      destinationLng,
      pricePerKm,
    } = body as Record<string, unknown>;

    // ── Validate pickupSource ───
    if (pickupSource !== "manual" && pickupSource !== "geolocation") {
      return new Response(
        JSON.stringify({ error: 'pickupSource doit être "manual" ou "geolocation".' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Validate pricePerKm ───
    if (typeof pricePerKm !== "number" || pricePerKm <= 0) {
      return new Response(
        JSON.stringify({ error: "L'annonce ne contient pas toutes les informations nécessaires." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Resolve owner point ───
    let owner: GeoPoint;
    if (isValidLatLng(ownerLat, ownerLng)) {
      owner = { lat: ownerLat as number, lng: ownerLng as number, address: ownerAddress as string | undefined };
    } else if (typeof ownerAddress === "string" && ownerAddress.trim()) {
      owner = await geocodeAddress(ownerAddress.trim(), apiKey);
    } else {
      return new Response(
        JSON.stringify({ error: "L'annonce ne contient pas toutes les informations nécessaires." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Resolve pickup point ───
    let pickup: GeoPoint;
    if (pickupSource === "geolocation") {
      if (!isValidLatLng(pickupLat, pickupLng)) {
        return new Response(
          JSON.stringify({ error: "Coordonnées de géolocalisation invalides." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      pickup = { lat: pickupLat as number, lng: pickupLng as number };
    } else {
      if (typeof rawPickupAddress !== "string" || !rawPickupAddress.trim()) {
        return new Response(
          JSON.stringify({ error: "Adresse vide." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      pickup = await geocodeAddress(rawPickupAddress.trim(), apiKey);
    }

    // ── Resolve destination point ───
    let destination: GeoPoint;
    if (isValidLatLng(destinationLat, destinationLng)) {
      destination = {
        lat: destinationLat as number,
        lng: destinationLng as number,
        address: destinationAddress as string | undefined,
      };
    } else if (typeof destinationAddress === "string" && destinationAddress.trim()) {
      destination = await geocodeAddress(destinationAddress.trim(), apiKey);
    } else {
      return new Response(
        JSON.stringify({ error: "L'annonce ne contient pas toutes les informations nécessaires." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
    const totalDistKm = round1(distOwnerToPickupKm + distPickupToDestKm);
    const totalDurationMin = Math.round((seg1.durationS + seg2.durationS) / 60);
    const totalPrice = round2(totalDistKm * (pricePerKm as number));

    const result: RoutePricingResult = {
      distanceOwnerToPickupKm: distOwnerToPickupKm,
      distancePickupToDestinationKm: distPickupToDestKm,
      totalDistanceKm: totalDistKm,
      estimatedDurationMinutes: totalDurationMin,
      pricePerKm: pricePerKm as number,
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
