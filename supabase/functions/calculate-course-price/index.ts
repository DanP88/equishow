import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface CourseCalculationRequest {
  annonce_id: string;
  nb_jours: number;
  commission_rate?: number; // En pourcentage (ex: 5 = 5%)
}

interface CourseCalculationResponse {
  price_per_day_ttc: number;
  total_amount_ht: number;
  platform_commission: number;
  total_amount_ttc: number;
  commission_rate: number;
  vat_amount: number;
}

// Constantes de calcul
const VAT_RATE = 0.20; // 20% TVA
const DEFAULT_COMMISSION_RATE = 5; // 5% commission par défaut

// ============================================================================
// FONCTION DE CALCUL SÉCURISÉE (côté serveur)
// ============================================================================

function calculateCoursePrice(
  price_per_day_ttc: number,
  nb_jours: number,
  commission_rate: number = DEFAULT_COMMISSION_RATE
): CourseCalculationResponse {
  // Validation
  if (!price_per_day_ttc || price_per_day_ttc <= 0) {
    throw new Error("Prix par jour invalide");
  }
  if (!nb_jours || nb_jours <= 0) {
    throw new Error("Nombre de jours invalide");
  }
  if (commission_rate < 0 || commission_rate > 100) {
    throw new Error("Taux de commission invalide");
  }

  // Le prix fourni est TTC, on doit retrouver le HT
  // TTC = HT × (1 + TVA)
  // HT = TTC / (1 + TVA)
  const price_per_day_ht = Math.round(
    (price_per_day_ttc / (1 + VAT_RATE)) * 100
  ) / 100;

  // Montant total HT
  const total_amount_ht = Math.round(price_per_day_ht * nb_jours * 100) / 100;

  // Commission plateforme sur le HT
  const commission_rate_decimal = commission_rate / 100;
  const platform_commission = Math.round(
    total_amount_ht * commission_rate_decimal * 100
  ) / 100;

  // TVA sur le HT
  const vat_amount = Math.round(total_amount_ht * VAT_RATE * 100) / 100;

  // Montant total TTC = HT + Commission + TVA
  const total_amount_ttc = Math.round(
    (total_amount_ht + platform_commission + vat_amount) * 100
  ) / 100;

  return {
    price_per_day_ttc: Math.round(price_per_day_ttc * 100) / 100,
    total_amount_ht,
    platform_commission,
    total_amount_ttc,
    commission_rate,
    vat_amount,
  };
}

// ============================================================================
// HANDLER EDGE FUNCTION
// ============================================================================

export async function handler(
  req: Request
): Promise<Response> {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Vérifier l'authentification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parser la requête
    const body: CourseCalculationRequest = await req.json();

    if (!body.annonce_id || !body.nb_jours) {
      return new Response(
        JSON.stringify({
          error:
            "Missing required fields: annonce_id, nb_jours",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Récupérer le client Supabase avec clé service_role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ========================================================================
    // ÉTAPE 1: Récupérer l'annonce depuis la BD
    // ========================================================================
    const { data: annonce, error: annonceError } = await supabase
      .from("coach_annonces")
      .select("id, prix_heure_ttc, auteur_id")
      .eq("id", body.annonce_id)
      .single();

    if (annonceError || !annonce) {
      return new Response(
        JSON.stringify({ error: "Annonce not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!annonce.prix_heure_ttc || annonce.prix_heure_ttc <= 0) {
      return new Response(
        JSON.stringify({
          error:
            "Annonce has invalid price",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ========================================================================
    // ÉTAPE 2: Calculer les prix côté serveur
    // ========================================================================
    const commission_rate = body.commission_rate ?? DEFAULT_COMMISSION_RATE;

    const calculation = calculateCoursePrice(
      annonce.prix_heure_ttc,
      body.nb_jours,
      commission_rate
    );

    // ========================================================================
    // ÉTAPE 3: Retourner les montants calculés
    // ========================================================================
    return new Response(JSON.stringify(calculation), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in calculate-course-price:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

Deno.serve(handler);
