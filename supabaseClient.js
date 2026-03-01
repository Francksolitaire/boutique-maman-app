// ============================================================
//  supabaseClient.js
//  Configuration de la connexion à Supabase.
//
//  Ce fichier initialise le client Supabase une seule fois
//  et l'exporte pour être utilisé dans toute l'application.
//
//  UTILISATION :
//    import { supabase } from '@/lib/supabaseClient'
//    const { data } = await supabase.from('produits').select('*')
//
//  EMPLACEMENT RECOMMANDÉ :
//    /lib/supabaseClient.js   (Next.js App Router)
// ============================================================

import { createClient } from '@supabase/supabase-js'

// ── Lecture des variables d'environnement ──────────────────
// Ces valeurs proviennent du fichier .env.local (développement)
// ou des variables d'environnement Vercel (production).
// Ne jamais écrire les clés en dur dans ce fichier !
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ── Vérification au démarrage ──────────────────────────────
// Si les variables manquent, l'application ne peut pas
// se connecter. On affiche une erreur claire plutôt qu'un
// message cryptique plus tard.
if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error(
    '❌ Variables Supabase manquantes.\n' +
    'Créez le fichier .env.local avec :\n' +
    'NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\n' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...'
  )
}

// ── Création du client Supabase ────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    // Garde la session de connexion dans localStorage du navigateur.
    // L'admin reste connecté même après fermeture de l'onglet.
    persistSession: true,

    // Renouvelle automatiquement le token JWT avant expiration.
    // Évite les déconnexions inattendues pendant l'utilisation.
    autoRefreshToken: true,

    // Désactive la détection d'un token dans l'URL.
    // Non nécessaire ici (pas de magic links ni OAuth).
    detectSessionInUrl: false,
  },
})

// ============================================================
//  Note sur les clés Supabase :
//
//  NEXT_PUBLIC_SUPABASE_URL      → URL du projet Supabase.
//  NEXT_PUBLIC_SUPABASE_ANON_KEY → Clé publique "anon".
//
//  La clé "anon" est PUBLIQUE par conception : elle est
//  visible dans le navigateur. La sécurité est assurée par
//  les règles RLS (Row Level Security) définies dans schema.sql,
//  pas par le secret de cette clé.
//
//  Ne jamais utiliser la clé "service_role" côté client !
//  Elle contourne toutes les règles RLS.
// ============================================================
