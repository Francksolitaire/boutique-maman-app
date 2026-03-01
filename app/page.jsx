"use client";
// ============================================================
//  page.jsx — BoutiqueApp v3 (version finale)
//  Fichier : app/page.jsx (Next.js 14, App Router)
//
//  Ce fichier contient l'intégralité de l'application :
//  ├── Configuration & constantes
//  ├── Utilitaires (formatage, WhatsApp, connexion)
//  ├── Contexte d'authentification (AuthProvider)
//  ├── Hooks de données (useProduits, useCommandes)
//  ├── Composants partagés (Btn, Card, Badge, Toast…)
//  ├── Composant UploadPhoto (appareil photo mobile)
//  ├── Composant FactureModal (impression + WhatsApp)
//  ├── Composant PanierDrawer (commande client)
//  ├── Page PageClient (catalogue public)
//  ├── Page PageAdmin (gestion boutique)
//  └── App Root (navigation, routing)
//
//  Dépendances : @supabase/supabase-js  tailwindcss
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
} from "react";
import { createClient } from "@supabase/supabase-js";


// ============================================================
//  CONFIGURATION SUPABASE
//  Les clés sont lues depuis les variables d'environnement
//  définies dans .env.local (voir .env.example).
// ============================================================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession:     true,   // session gardée après fermeture onglet
      autoRefreshToken:   true,   // renouvellement JWT automatique
      detectSessionInUrl: false,  // pas de magic links
    },
  }
);


// ============================================================
//  CONSTANTES BOUTIQUE
//  ← Modifier ces valeurs selon votre boutique réelle
// ============================================================
const BOUTIQUE = {
  nom:       "Boutique Mama Jeanne",
  telephone: "237691000000",                        // ← indicatif pays inclus, sans +
  adresse:   "Marché Central, Yaoundé – Cameroun",
  slogan:    "Qualité & Confiance depuis 2010",
};

// Frais de livraison en FCFA (0 = retrait en boutique uniquement)
const FRAIS_LIVRAISON = 2000;

// Nom du bucket Supabase Storage pour les photos produits
const STORAGE_BUCKET = "produits-photos";

// Seuil d'alerte stock critique (fond rouge si stock ≤ cette valeur)
const SEUIL_ALERTE_STOCK = 3;


// ============================================================
//  UTILITAIRES GLOBAUX
// ============================================================

/**
 * Formate un nombre en FCFA lisible (ex: 28500 → "28 500 FCFA")
 */
const formatFCFA = (n) =>
  new Intl.NumberFormat("fr-FR").format(n ?? 0) + " FCFA";

/**
 * Formate une date ISO en français lisible.
 * Retourne "—" si la valeur est nulle.
 */
const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("fr-FR", {
        day:    "2-digit",
        month:  "long",
        year:   "numeric",
        hour:   "2-digit",
        minute: "2-digit",
      })
    : "—";

/**
 * Retourne true si la valeur ressemble à une URL.
 * Permet de distinguer un emoji ("🍬") d'une URL de photo.
 */
const estUrl = (s) =>
  typeof s === "string" && (s.startsWith("http") || s.startsWith("/"));


// ============================================================
//  UTILITAIRE WHATSAPP
//  Construit le message texte du récapitulatif de commande
//  puis ouvre l'application WhatsApp avec ce message pré-rempli.
// ============================================================

/**
 * Génère le texte complet du message WhatsApp.
 * Les *astérisques* créent du gras dans WhatsApp.
 */
function construireMessageWhatsApp({
  client_nom,
  telephone,
  articles,
  total_articles,
  frais_livraison,
  total_fcfa,
  livraison,
  adresse,
  commandeId,
}) {
  // Ligne pour chaque article commandé
  const lignesArticles = articles
    .map(
      (a) =>
        `  • ${a.nom} × ${a.quantite} = ${formatFCFA(
          (a.prix_fcfa ?? a.prix) * a.quantite
        )}`
    )
    .join("\n");

  // Ligne frais livraison (omise si retrait en boutique)
  const ligneFreais =
    livraison === "livraison" && frais_livraison > 0
      ? `\n🚚 Frais de livraison : *${formatFCFA(frais_livraison)}*`
      : "";

  return [
    `🏪 *${BOUTIQUE.nom}*`,
    commandeId
      ? `📋 Commande N° *${commandeId}*`
      : `📋 *Nouvelle commande*`,
    `📅 ${fmtDate(new Date().toISOString())}`,
    "",
    `👤 Client : *${client_nom}*`,
    `📞 Tél    : ${telephone}`,
    "",
    `🛒 *Articles commandés :*`,
    lignesArticles,
    "",
    `💰 Sous-total : ${formatFCFA(total_articles)}` + ligneFreais,
    `━━━━━━━━━━━━━━━━━━`,
    `💵 *TOTAL À PAYER : ${formatFCFA(total_fcfa)}*`,
    "",
    livraison === "livraison"
      ? `🚚 *Livraison* à : ${adresse || "adresse à confirmer"}`
      : `🏪 *Retrait en boutique*`,
    "",
    `✅ Paiement à la réception`,
    `━━━━━━━━━━━━━━━━━━`,
    `Merci pour votre confiance ! 🙏`,
  ].join("\n");
}

/**
 * Ouvre l'application WhatsApp avec le message pré-rempli
 * adressé au numéro de la boutique.
 */
function ouvrirWhatsApp(message) {
  const tel = BOUTIQUE.telephone.replace(/\D/g, ""); // supprime tous les non-chiffres
  window.open(
    `https://wa.me/${tel}?text=${encodeURIComponent(message)}`,
    "_blank"
  );
}

/** Icône WhatsApp SVG (intégrée pour éviter une dépendance externe) */
const IconeWhatsApp = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={`fill-current ${className}`}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.112 1.523 5.84L0 24l6.336-1.498A11.947 11.947 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.647-.5-5.17-1.374l-.37-.22-3.76.888.93-3.672-.242-.38A9.945 9.945 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
  </svg>
);


// ============================================================
//  HOOK : useConnexion
//  Surveille l'état de la connexion Internet et l'accessibilité
//  de Supabase. Utilisé pour le voyant vert/rouge en admin.
// ============================================================
function useConnexion() {
  // État initial : on suppose que le navigateur est en ligne
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  // null = vérification en cours | true = ok | false = erreur
  const [supabaseOk, setSupabaseOk] = useState(null);

  // Écoute les événements de connexion/déconnexion du navigateur
  useEffect(() => {
    const goOnline  = () => setOnline(true);
    const goOffline = () => {
      setOnline(false);
      setSupabaseOk(false);
    };
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Ping Supabase : vérifie que la BDD répond vraiment
  const ping = useCallback(async () => {
    if (!navigator.onLine) { setSupabaseOk(false); return; }
    try {
      const debut = Date.now();
      await supabase.from("produits").select("id").limit(1).maybeSingle();
      // Considère comme OK si la réponse arrive en moins de 8 secondes
      setSupabaseOk(Date.now() - debut < 8000);
    } catch {
      setSupabaseOk(false);
    }
  }, []);

  // Premier ping au montage + vérification toutes les 30 secondes
  useEffect(() => {
    ping();
    const intervalle = setInterval(ping, 30_000);
    return () => clearInterval(intervalle);
  }, [ping]);

  return {
    connecte:      online && supabaseOk !== false,
    verification:  supabaseOk === null,
  };
}

/**
 * Composant voyant de connexion (affiché dans le header admin).
 * Vert pulsant = connecté | Amber = vérification | Rouge = hors ligne
 */
function VoyantConnexion() {
  const { connecte, verification } = useConnexion();

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-3 w-3">
        {/* Anneau animé (ping) visible uniquement si connecté */}
        {connecte && !verification && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        )}
        <span
          className={`relative inline-flex rounded-full h-3 w-3 ${
            verification ? "bg-amber-400" :
            connecte     ? "bg-emerald-500" :
                           "bg-red-500"
          }`}
        />
      </span>
      <span
        className={`text-xs font-bold ${
          verification ? "text-amber-400" :
          connecte     ? "text-emerald-400" :
                         "text-red-400"
        }`}
      >
        {verification ? "Vérification…" :
         connecte     ? "Connecté" :
                        "Hors ligne"}
      </span>
    </div>
  );
}


// ============================================================
//  CONTEXTE D'AUTHENTIFICATION
//  Partage l'état de connexion (user, login, logout)
//  dans toute l'arborescence de composants.
// ============================================================
const AuthCtx = createContext(null);

function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true); // true pendant la vérification initiale

  useEffect(() => {
    // Récupère la session existante au chargement de la page
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Écoute les changements d'état (connexion / déconnexion)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setUser(session?.user ?? null)
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, motDePasse) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: motDePasse,
    });
    if (error) throw error;
    return data;
  };

  const logout = () => supabase.auth.signOut();

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

/** Hook pour accéder facilement au contexte d'auth */
const useAuth = () => useContext(AuthCtx);


// ============================================================
//  HOOK : useProduits
//  Gère le chargement et la modification du catalogue produits.
//  Inclut l'upload de photos vers Supabase Storage.
// ============================================================
function useProduits() {
  const [produits, setProduits] = useState([]);
  const [loading,  setLoading]  = useState(true);

  /** Charge tous les produits actifs, triés par catégorie puis nom */
  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("produits")
      .select("*")
      .eq("actif", true)
      .order("categorie")
      .order("nom");
    if (data) setProduits(data);
    setLoading(false);
  }, []);

  // Chargement initial
  useEffect(() => { charger(); }, [charger]);

  /**
   * Uploade un fichier image vers Supabase Storage.
   * Retourne l'URL publique de l'image stockée.
   * Utilisé par le composant UploadPhoto.
   */
  const uploadPhoto = async (fichier, produitId) => {
    const ext  = fichier.name.split(".").pop().toLowerCase() || "jpg";
    const path = `${produitId || Date.now()}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, fichier, { upsert: true, contentType: fichier.type });

    if (error) throw error;

    // Récupère l'URL publique (accessible sans authentification)
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  /**
   * Crée ou met à jour un produit.
   * Si p.id est défini → update. Sinon → insert.
   */
  const sauvegarder = async (p) => {
    const payload = {
      nom:           p.nom,
      categorie:     p.categorie,
      prix_fcfa:     Number(p.prix_fcfa),
      stock_cartons: Number(p.stock_cartons),
      unite:         p.unite,
      description:   p.description,
      photo:         p.photo,
      actif:         true,
    };
    if (p.id) payload.id = p.id;

    const { error } = await supabase
      .from("produits")
      .upsert(payload, { onConflict: "id" });

    if (error) throw error;
    await charger(); // Rafraîchit la liste
  };

  /**
   * Suppression douce : passe actif = false.
   * Le produit reste en base pour l'historique.
   */
  const desactiver = async (id) => {
    const { error } = await supabase
      .from("produits")
      .update({ actif: false })
      .eq("id", id);
    if (error) throw error;
    await charger();
  };

  return {
    produits,
    loading,
    uploadPhoto,
    sauvegarder,
    desactiver,
    recharger: charger,
  };
}


// ============================================================
//  HOOK : useCommandes
//  Gère le chargement des commandes et leur validation.
// ============================================================
function useCommandes() {
  const [commandes, setCommandes] = useState([]);
  const [loading,   setLoading]   = useState(true);

  /** Charge toutes les commandes, les plus récentes en premier */
  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("commandes")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCommandes(data);
    setLoading(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  /**
   * Enregistre une nouvelle commande en base.
   * Génère l'identifiant CMD-XXX automatiquement.
   * Retourne l'ID généré.
   */
  const creer = async (donneesCommande) => {
    // Compte les commandes existantes pour générer l'ID suivant
    const { count } = await supabase
      .from("commandes")
      .select("*", { count: "exact", head: true });

    const id = `CMD-${String((count || 0) + 1).padStart(3, "0")}`;

    const { error } = await supabase
      .from("commandes")
      .insert({ ...donneesCommande, id });

    if (error) throw error;
    await charger();
    return id;
  };

  /**
   * Valide une commande via la fonction PostgreSQL atomique.
   * Cette fonction gère en une seule transaction :
   *   - Décrémentation des stocks
   *   - Écriture dans l'historique
   *   - Passage de la commande en "validee"
   *   - Création de la facture immuable
   *
   * Si une erreur survient (stock insuffisant par ex.),
   * TOUT est annulé automatiquement (rollback).
   */
  const valider = async (commandeId, userId) => {
    const { data, error } = await supabase.rpc("valider_commande", {
      p_commande_id: commandeId,
      p_user_id:     userId,
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Erreur de validation");

    await charger();
    return data;
  };

  return {
    commandes,
    loading,
    creer,
    valider,
    recharger: charger,
  };
}


// ============================================================
//  COMPOSANTS UI PARTAGÉS
// ============================================================

/**
 * Bouton polyvalent avec plusieurs couleurs, tailles et
 * état de chargement (spinner animé intégré).
 */
const Btn = ({
  children,
  onClick,
  color    = "orange",
  size     = "md",
  full     = false,
  disabled = false,
  loading: enChargement = false,
  className = "",
}) => {
  const couleurs = {
    orange:   "bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white shadow-lg shadow-orange-200",
    green:    "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-lg shadow-emerald-200",
    whatsapp: "bg-[#25D366] hover:bg-[#1ebe5b] active:bg-[#17a84e] text-white shadow-lg shadow-green-200",
    red:      "bg-red-500 hover:bg-red-600 text-white",
    ghost:    "bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-200",
    dark:     "bg-gray-900 hover:bg-gray-800 text-white",
  };
  const tailles = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg font-bold",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || enChargement}
      className={`
        ${couleurs[color]} ${tailles[size]}
        ${full ? "w-full" : ""}
        rounded-2xl font-semibold transition-all duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        flex items-center justify-center gap-2
        ${className}
      `}
    >
      {enChargement
        ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        : children
      }
    </button>
  );
};

/** Carte blanche avec bords arrondis et ombre légère */
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-3xl shadow-sm border border-gray-100 ${className}`}>
    {children}
  </div>
);

/** Badge coloré pour les statuts et identifiants */
const Badge = ({ children, color = "orange" }) => {
  const couleurs = {
    orange: "bg-orange-100 text-orange-700",
    green:  "bg-emerald-100 text-emerald-700",
    red:    "bg-red-100 text-red-700",
    gray:   "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`${couleurs[color]} text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap`}>
      {children}
    </span>
  );
};

/** Indicateur de chargement animé */
const Spinner = ({ texte = "Chargement…" }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-4">
    <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    <div className="text-gray-500 font-medium text-sm">{texte}</div>
  </div>
);

/** Notification temporaire (apparaît 3,5 secondes) */
function Toast({ toast }) {
  if (!toast) return null;
  const styles = {
    success: "bg-emerald-500",
    error:   "bg-red-500",
    warn:    "bg-amber-500",
  };
  return (
    <div className={`fixed top-4 right-4 z-[100] ${styles[toast.type] || styles.success} text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2`}>
      {toast.type === "error" ? "❌" : toast.type === "warn" ? "⚠️" : "✅"}
      {toast.msg}
    </div>
  );
}

/** Hook pour déclencher facilement des toasts */
function useToast() {
  const [toast, setToast] = useState(null);
  const afficher = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };
  return [toast, afficher];
}

/**
 * Affiche une image produit.
 * Si "photo" est une URL → affiche l'image.
 * Si "photo" est un emoji → affiche l'emoji centré.
 * Gère les deux cas de manière transparente.
 */
function ImageProduit({ photo, taille = "md", className = "" }) {
  const dimensions = {
    sm:  "w-10 h-10 text-2xl",
    md:  "w-14 h-14 text-4xl",
    lg:  "w-20 h-20 text-5xl",
    xl:  "w-24 h-24 text-6xl",
  };

  if (estUrl(photo)) {
    return (
      <img
        src={photo}
        alt="produit"
        className={`${dimensions[taille].replace(/text-\S+/, "").trim()} object-cover rounded-2xl bg-gray-100 flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div className={`${dimensions[taille]} bg-gradient-to-br from-orange-50 to-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0 ${className}`}>
      {photo || "📦"}
    </div>
  );
}


// ============================================================
//  COMPOSANT : UploadPhoto
//  Permet à l'admin de photographier un produit directement
//  avec l'appareil photo du téléphone (mobile) ou de
//  sélectionner une image depuis la galerie (desktop).
// ============================================================
const EMOJIS_PRODUITS = [
  "🥫","🍬","🧼","🍪","🫙","🥛","🫧","🟡","💧","🧃",
  "🌾","🐟","🍾","🫒","🥤","🧂","🍯","🫘","🧅","🧄",
];

function UploadPhoto({ photoActuelle, onFichierSelectionne }) {
  const [apercu,      setApercu]      = useState(null);
  const [enChargement, setEnChargement] = useState(false);

  const validerFichier = (fichier) => {
    if (!fichier) return;
    // Limite à 5 Mo pour économiser la bande passante mobile
    if (fichier.size > 5 * 1024 * 1024) {
      alert("Photo trop lourde (maximum 5 Mo). Prenez une photo de taille normale.");
      return;
    }
    // Génère un aperçu local immédiat (sans uploader encore)
    const urlLocale = URL.createObjectURL(fichier);
    setApercu(urlLocale);
    onFichierSelectionne(fichier);
  };

  const supprimerPhoto = () => {
    setApercu(null);
    onFichierSelectionne(null);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold text-gray-600">
        📸 Photo du produit
      </label>

      {/* Zone de prévisualisation */}
      <div className="relative w-full h-44 bg-gradient-to-br from-orange-50 to-amber-100 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-dashed border-orange-200">
        {apercu || estUrl(photoActuelle) ? (
          <>
            <img
              src={apercu || photoActuelle}
              alt="prévisualisation"
              className="w-full h-full object-cover rounded-2xl"
            />
            {/* Bouton supprimer */}
            <button
              onClick={supprimerPhoto}
              className="absolute top-2 right-2 bg-red-500 text-white w-8 h-8 rounded-full font-bold flex items-center justify-center text-sm shadow-lg hover:bg-red-600"
            >
              ✕
            </button>
          </>
        ) : (
          <div className="text-center text-gray-400">
            <div className="text-5xl mb-2">
              {!estUrl(photoActuelle) ? (photoActuelle || "📷") : "📷"}
            </div>
            <div className="text-xs font-medium">Aucune photo</div>
          </div>
        )}
        {enChargement && (
          <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Boutons de sélection */}
      <div className="grid grid-cols-2 gap-2">
        {/*
          capture="environment" → ouvre la caméra ARRIÈRE du téléphone.
          C'est l'attribut clé pour "prendre une photo" sur mobile.
          Sur desktop, ouvre simplement le sélecteur de fichiers.
        */}
        <label className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-3 px-4 rounded-2xl font-bold text-sm cursor-pointer transition-all active:scale-95">
          📷 Prendre photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => validerFichier(e.target.files?.[0])}
          />
        </label>

        {/* Sélection depuis la galerie (pas capture) */}
        <label className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-200 py-3 px-4 rounded-2xl font-bold text-sm cursor-pointer transition-all active:scale-95">
          🖼️ Galerie
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => validerFichier(e.target.files?.[0])}
          />
        </label>
      </div>
      <div className="text-xs text-gray-400 text-center">
        Formats acceptés : JPG, PNG, WEBP — Max 5 Mo
      </div>
    </div>
  );
}


// ============================================================
//  COMPOSANT : FactureModal
//  Affiche la facture en modal avec 3 actions :
//  ① Partager via WhatsApp (message texte formaté)
//  ② Imprimer (ouvre une fenêtre HTML optimisée impression)
//  ③ Fermer
// ============================================================
function FactureModal({ commande, onFermer }) {
  if (!commande) return null;

  // Les articles peuvent être une string JSON ou un tableau
  const articles =
    typeof commande.articles_json === "string"
      ? JSON.parse(commande.articles_json)
      : (commande.articles_json || []);

  const frais      = commande.frais_livraison ?? 0;
  const sousTotal  = articles.reduce(
    (s, a) => s + (a.prix_fcfa ?? a.prix) * a.quantite,
    0
  );

  /** Ouvre WhatsApp avec le récapitulatif complet */
  const partagerWhatsApp = () => {
    const msg = construireMessageWhatsApp({
      client_nom:      commande.client_nom,
      telephone:       commande.telephone,
      articles,
      total_articles:  sousTotal,
      frais_livraison: frais,
      total_fcfa:      commande.total_fcfa,
      livraison:       commande.livraison,
      adresse:         commande.adresse,
      commandeId:      commande.id,
    });
    ouvrirWhatsApp(msg);
  };

  /** Génère et ouvre une fenêtre HTML pour l'impression */
  const imprimer = () => {
    const w = window.open("", "_blank");

    w.document.write(`<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8">
<title>Facture ${commande.id} — ${BOUTIQUE.nom}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Nunito', sans-serif;
    padding: 40px;
    color: #1a1a1a;
    background: #fff;
    max-width: 800px;
    margin: 0 auto;
  }
  /* En-tête boutique */
  .entete {
    border-bottom: 4px solid #f97316;
    padding-bottom: 24px;
    margin-bottom: 28px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .boutique-nom   { font-size: 26px; font-weight: 800; color: #ea580c; }
  .boutique-infos { font-size: 13px; color: #666; margin-top: 6px; line-height: 1.7; }
  .facture-titre  { font-size: 18px; font-weight: 700; text-align: right; }
  .facture-meta   { font-size: 12px; color: #666; text-align: right; margin-top: 4px; line-height: 1.6; }
  /* Sections */
  .titre-section {
    font-size: 11px; font-weight: 800; text-transform: uppercase;
    color: #999; letter-spacing: .08em; margin: 24px 0 10px;
  }
  .bloc-client {
    background: #fff7ed; border-radius: 12px;
    padding: 16px 20px; border-left: 4px solid #f97316;
  }
  /* Tableau articles */
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  thead th {
    background: #1f2937; color: #fff;
    padding: 12px 14px; text-align: left;
    font-size: 13px; font-weight: 700;
  }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody td { padding: 11px 14px; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
  /* Bloc totaux */
  .totaux { margin-top: 20px; border: 2px solid #fed7aa; border-radius: 16px; overflow: hidden; }
  .totaux-ligne { display: flex; justify-content: space-between; padding: 10px 20px; font-size: 14px; }
  .totaux-livraison { background: #f0fdf4; color: #15803d; font-weight: 700; }
  .totaux-final {
    background: linear-gradient(135deg, #fff7ed, #ffedd5);
    font-size: 22px; font-weight: 800; color: #ea580c; padding: 16px 20px;
  }
  /* Tampon validé */
  .tampon {
    display: inline-block; border: 3px solid #10b981; border-radius: 10px;
    padding: 8px 20px; color: #10b981; font-weight: 800; font-size: 18px;
    transform: rotate(-4deg); margin-top: 20px; letter-spacing: .05em;
  }
  /* Pied de page */
  .pied {
    margin-top: 48px; border-top: 1px solid #e5e7eb;
    padding-top: 16px; text-align: center;
    font-size: 12px; color: #9ca3af; line-height: 1.8;
  }
  @media print { body { padding: 20px; } button { display: none !important; } }
</style></head><body>

<div class="entete">
  <div>
    <div class="boutique-nom">🏪 ${BOUTIQUE.nom}</div>
    <div class="boutique-infos">
      ${BOUTIQUE.adresse}<br/>
      Tél : ${BOUTIQUE.telephone}<br/>
      <em>${BOUTIQUE.slogan}</em>
    </div>
  </div>
  <div>
    <div class="facture-titre">REÇU / FACTURE</div>
    <div class="facture-meta">
      N° ${commande.id}<br/>
      ${fmtDate(commande.created_at)}
    </div>
  </div>
</div>

<div class="titre-section">Informations client</div>
<div class="bloc-client">
  <strong style="font-size:16px">${commande.client_nom}</strong>
  &nbsp;•&nbsp; Tél : ${commande.telephone}<br/>
  Mode : <strong>${commande.livraison === "livraison" ? "🚚 Livraison à domicile" : "🏪 Retrait en boutique"}</strong>
  ${commande.adresse ? `<br/>Adresse : ${commande.adresse}` : ""}
</div>

<div class="titre-section">Détail de la commande</div>
<table>
  <thead>
    <tr><th>Produit</th><th>Qté</th><th>Prix unitaire</th><th>Sous-total</th></tr>
  </thead>
  <tbody>
    ${articles
      .map(
        (a) => `
    <tr>
      <td>${a.nom}</td>
      <td>${a.quantite}</td>
      <td>${formatFCFA(a.prix_fcfa ?? a.prix)}</td>
      <td><strong>${formatFCFA((a.prix_fcfa ?? a.prix) * a.quantite)}</strong></td>
    </tr>`
      )
      .join("")}
  </tbody>
</table>

<div class="totaux">
  <div class="totaux-ligne">
    <span>Sous-total articles</span>
    <span>${formatFCFA(sousTotal)}</span>
  </div>
  ${
    frais > 0
      ? `<div class="totaux-ligne totaux-livraison">
           <span>🚚 Frais de livraison</span>
           <span>+ ${formatFCFA(frais)}</span>
         </div>`
      : ""
  }
  <div class="totaux-ligne totaux-final">
    <span>TOTAL À PAYER</span>
    <span>${formatFCFA(commande.total_fcfa)}</span>
  </div>
</div>

<div style="text-align:center">
  <div class="tampon">✓ VALIDÉE</div>
</div>

<div class="pied">
  Merci pour votre confiance et votre fidélité !<br/>
  ${BOUTIQUE.nom} — ${BOUTIQUE.telephone} — ${BOUTIQUE.adresse}
</div>

<script>window.onload = () => { window.print(); }</script>
</body></html>`);

    w.document.close();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onFermer}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-t-3xl text-white">
          <div className="text-2xl font-black">🧾 Facture N° {commande.id}</div>
          <div className="text-orange-100 text-sm mt-1">{fmtDate(commande.created_at)}</div>
        </div>

        <div className="p-6 space-y-5">
          {/* Nom de la boutique */}
          <div className="bg-orange-50 rounded-2xl p-4">
            <div className="font-black text-orange-600 text-lg">🏪 {BOUTIQUE.nom}</div>
            <div className="text-sm text-gray-600 mt-1">{BOUTIQUE.adresse}</div>
          </div>

          {/* Informations client */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <div className="text-xs font-bold text-gray-400 uppercase mb-2">Client</div>
            <div className="font-bold text-gray-800 text-lg">{commande.client_nom}</div>
            <div className="text-gray-600 text-sm">📞 {commande.telephone}</div>
            <div className="text-gray-600 text-sm mt-1">
              {commande.livraison === "livraison" ? "🚚 Livraison" : "🏪 Retrait boutique"}
              {commande.adresse && ` — ${commande.adresse}`}
            </div>
          </div>

          {/* Liste des articles */}
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase mb-3">Articles</div>
            <div className="space-y-2">
              {articles.map((a, i) => (
                <div key={i} className="flex justify-between items-center bg-gray-50 rounded-xl p-3">
                  <div>
                    <div className="font-semibold text-gray-800">{a.nom}</div>
                    <div className="text-sm text-gray-500">
                      {a.quantite} × {formatFCFA(a.prix_fcfa ?? a.prix)}
                    </div>
                  </div>
                  <div className="font-bold text-orange-600">
                    {formatFCFA((a.prix_fcfa ?? a.prix) * a.quantite)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bloc totaux avec frais de livraison */}
          <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
            <div className="flex justify-between px-4 py-3 text-sm">
              <span className="text-gray-600">Sous-total articles</span>
              <span className="font-bold">{formatFCFA(sousTotal)}</span>
            </div>
            {frais > 0 && (
              <div className="flex justify-between px-4 py-3 text-sm bg-emerald-50">
                <span className="text-emerald-700 font-semibold">🚚 Frais de livraison</span>
                <span className="font-bold text-emerald-700">+ {formatFCFA(frais)}</span>
              </div>
            )}
            <div className="flex justify-between px-4 py-4 bg-gradient-to-r from-emerald-50 to-emerald-100 border-t border-emerald-200">
              <span className="font-black text-gray-700">TOTAL À PAYER</span>
              <span className="text-2xl font-black text-emerald-700">
                {formatFCFA(commande.total_fcfa)}
              </span>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="space-y-3 pt-1">
            {/* WhatsApp — bouton principal, plus grand */}
            <Btn color="whatsapp" full size="lg" onClick={partagerWhatsApp}>
              <IconeWhatsApp /> Envoyer via WhatsApp
            </Btn>
            <div className="grid grid-cols-2 gap-3">
              <Btn color="ghost" onClick={onFermer}>← Fermer</Btn>
              <Btn color="green" onClick={imprimer}>🖨️ Imprimer</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ============================================================
//  PAGE : Connexion Admin
// ============================================================
function PageConnexion({ onRetour }) {
  const { login } = useAuth();
  const [email,  setEmail]  = useState("");
  const [mdp,    setMdp]    = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const seConnecter = async () => {
    setErreur("");
    setChargement(true);
    try {
      await login(email, mdp);
      // La redirection est gérée par AppContent via le changement de user
    } catch (e) {
      setErreur(
        e.message.includes("Invalid")
          ? "Email ou mot de passe incorrect"
          : e.message
      );
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-7xl mb-4">🔐</div>
          <div className="text-3xl font-black text-white">{BOUTIQUE.nom}</div>
          <div className="text-gray-400 mt-2 text-sm">Espace Administrateur</div>
        </div>

        <Card className="p-6 space-y-4">
          {/* Champ email */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErreur(""); }}
              onKeyDown={(e) => e.key === "Enter" && seConnecter()}
              placeholder="admin@boutique.cm"
              className={`w-full border-2 rounded-2xl px-4 py-3 text-base font-medium focus:outline-none transition-colors ${
                erreur ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-orange-400"
              }`}
            />
          </div>

          {/* Champ mot de passe */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={mdp}
              onChange={(e) => { setMdp(e.target.value); setErreur(""); }}
              onKeyDown={(e) => e.key === "Enter" && seConnecter()}
              placeholder="••••••••"
              className={`w-full border-2 rounded-2xl px-4 py-3 text-base font-medium focus:outline-none transition-colors ${
                erreur ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-orange-400"
              }`}
            />
          </div>

          {/* Message d'erreur */}
          {erreur && (
            <div className="bg-red-50 text-red-600 text-sm font-semibold px-4 py-3 rounded-xl border border-red-200">
              ❌ {erreur}
            </div>
          )}

          <Btn color="orange" full size="lg" onClick={seConnecter} loading={chargement}>
            {!chargement && "Connexion →"}
          </Btn>

          <button
            onClick={onRetour}
            className="w-full text-gray-400 hover:text-gray-600 text-sm font-medium py-2 transition-colors"
          >
            ← Retour à la boutique
          </button>
        </Card>

        <div className="text-center mt-4 text-gray-600 text-xs">
          Accès réservé — {BOUTIQUE.nom}
        </div>
      </div>
    </div>
  );
}


// ============================================================
//  COMPOSANT : PanierDrawer
//  Panneau latéral de commande en 3 étapes :
//  1. Révision du panier
//  2. Saisie des informations client + mode livraison
//  3. Confirmation (envoi WhatsApp + enregistrement BDD)
// ============================================================
function PanierDrawer({ panier, onFermer, onModifierQty, onSupprimer, onCommandeEnvoyee }) {
  const { creer } = useCommandes();

  const [client, setClient] = useState({
    nom: "", telephone: "", livraison: "retrait", adresse: ""
  });
  const [etape,       setEtape]       = useState("panier");  // panier | infos | confirm
  const [chargement,  setChargement]  = useState(false);
  const [commandeId,  setCommandeId]  = useState(null);

  // Calculs financiers
  const sousTotal    = panier.reduce((s, i) => s + i.prix_fcfa * i.quantite, 0);
  const frais        = client.livraison === "livraison" ? FRAIS_LIVRAISON : 0;
  const total        = sousTotal + frais;
  const nbArticles   = panier.reduce((s, i) => s + i.quantite, 0);

  /** Enregistre la commande en BDD et ouvre WhatsApp */
  const envoyerCommande = async () => {
    setChargement(true);
    try {
      const articles = panier.map((i) => ({
        produitId: i.id,
        nom:       i.nom,
        prix_fcfa: i.prix_fcfa,
        quantite:  i.quantite,
      }));

      // Enregistrement en base de données
      const id = await creer({
        client_nom:      client.nom,
        telephone:       client.telephone,
        articles_json:   articles,
        total_fcfa:      total,
        frais_livraison: frais,
        livraison:       client.livraison,
        adresse:         client.adresse,
        statut:          "en_attente",
      });

      setCommandeId(id);

      // Ouverture de WhatsApp avec le récapitulatif
      const msg = construireMessageWhatsApp({
        client_nom:      client.nom,
        telephone:       client.telephone,
        articles,
        total_articles:  sousTotal,
        frais_livraison: frais,
        total_fcfa:      total,
        livraison:       client.livraison,
        adresse:         client.adresse,
        commandeId:      id,
      });
      ouvrirWhatsApp(msg);

      onCommandeEnvoyee(); // Vide le panier dans le composant parent
      setEtape("confirm");
    } catch (e) {
      alert("Erreur lors de l'envoi : " + e.message);
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Fond semi-transparent — clic pour fermer */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onFermer} />

      {/* Panneau latéral droit */}
      <div className="w-full max-w-md bg-white h-full overflow-y-auto flex flex-col shadow-2xl">

        {/* En-tête du panneau */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-5 text-white flex justify-between items-center sticky top-0 z-10">
          <div>
            <div className="text-xl font-black">🛒 Mon Panier</div>
            <div className="text-gray-400 text-sm">
              {nbArticles} article{nbArticles > 1 ? "s" : ""}
            </div>
          </div>
          <button
            onClick={onFermer}
            className="text-gray-400 hover:text-white text-3xl font-light leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 p-5 space-y-4 pb-8">

          {/* ── ÉTAPE 3 : Confirmation ───────────────────── */}
          {etape === "confirm" && (
            <div className="text-center py-10 space-y-5">
              <div className="text-8xl">🎉</div>
              <div className="text-2xl font-black text-gray-800">Commande envoyée !</div>
              <div className="bg-emerald-50 rounded-2xl p-5 text-left space-y-2 border border-emerald-200">
                <div className="text-sm text-emerald-700 font-semibold">
                  ✅ Commande N° <strong>{commandeId}</strong> enregistrée
                </div>
                <div className="text-sm text-emerald-700">
                  ✅ Récapitulatif envoyé via WhatsApp
                </div>
                <div className="text-sm text-emerald-700">
                  ✅ La boutique vous contactera bientôt
                </div>
              </div>

              {/* Bouton renvoyer le message WhatsApp si besoin */}
              <Btn
                color="whatsapp"
                full
                onClick={() => {
                  const articles = panier.map((i) => ({
                    nom: i.nom, prix_fcfa: i.prix_fcfa, quantite: i.quantite,
                  }));
                  const msg = construireMessageWhatsApp({
                    client_nom: client.nom, telephone: client.telephone,
                    articles, total_articles: sousTotal,
                    frais_livraison: frais, total_fcfa: total,
                    livraison: client.livraison, adresse: client.adresse,
                    commandeId,
                  });
                  ouvrirWhatsApp(msg);
                }}
              >
                <IconeWhatsApp /> Renvoyer le récapitulatif
              </Btn>

              <Btn color="ghost" full onClick={onFermer}>
                Continuer mes achats
              </Btn>
            </div>
          )}

          {/* ── ÉTAPE 2 : Informations client ────────────── */}
          {etape === "infos" && (
            <>
              <div className="text-lg font-black text-gray-800">📋 Vos informations</div>
              <div className="space-y-4">
                {/* Nom et téléphone */}
                {[
                  ["nom",       "Votre nom complet *", "text", "Marie Ngono"],
                  ["telephone", "Numéro de téléphone *", "tel", "6XXXXXXXX"],
                ].map(([cle, label, type, placeholder]) => (
                  <div key={cle}>
                    <label className="block text-sm font-bold text-gray-600 mb-2">
                      {label}
                    </label>
                    <input
                      type={type}
                      value={client[cle]}
                      onChange={(e) =>
                        setClient((p) => ({ ...p, [cle]: e.target.value }))
                      }
                      placeholder={placeholder}
                      className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-base font-medium focus:border-orange-400 focus:outline-none"
                    />
                  </div>
                ))}

                {/* Choix du mode de réception */}
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">
                    Mode de réception *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["retrait",   "🏪", "Retrait boutique", "Gratuit"],
                      ["livraison", "🚚", "Livraison à domicile", `+ ${formatFCFA(FRAIS_LIVRAISON)}`],
                    ].map(([valeur, icone, label, sous]) => (
                      <button
                        key={valeur}
                        onClick={() =>
                          setClient((p) => ({ ...p, livraison: valeur }))
                        }
                        className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all text-left ${
                          client.livraison === valeur
                            ? "border-orange-500 bg-orange-50 text-orange-700"
                            : "border-gray-200 text-gray-600"
                        }`}
                      >
                        <div className="text-2xl mb-1">{icone}</div>
                        <div>{label}</div>
                        <div className={`text-xs mt-0.5 font-semibold ${
                          valeur === "livraison" ? "text-emerald-600" : "text-gray-400"
                        }`}>
                          {sous}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Adresse (visible uniquement si livraison) */}
                {client.livraison === "livraison" && (
                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">
                      Adresse de livraison *
                    </label>
                    <input
                      value={client.adresse}
                      onChange={(e) =>
                        setClient((p) => ({ ...p, adresse: e.target.value }))
                      }
                      placeholder="Ex: Bastos, Yaoundé"
                      className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-base font-medium focus:border-orange-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Récapitulatif des totaux avec frais de livraison */}
              <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
                <div className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-gray-600">Sous-total</span>
                  <span className="font-bold">{formatFCFA(sousTotal)}</span>
                </div>
                {frais > 0 && (
                  <div className="flex justify-between px-4 py-3 text-sm bg-emerald-50">
                    <span className="text-emerald-700 font-semibold">🚚 Frais de livraison</span>
                    <span className="font-bold text-emerald-700">
                      + {formatFCFA(frais)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-4 border-t border-gray-200">
                  <span className="font-black text-gray-800 text-lg">TOTAL</span>
                  <span className="font-black text-orange-600 text-xl">
                    {formatFCFA(total)}
                  </span>
                </div>
                <div className="px-4 pb-3 text-xs text-gray-400">
                  Paiement à la réception
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Btn color="ghost" onClick={() => setEtape("panier")}>
                  ← Retour
                </Btn>
                <Btn
                  color="whatsapp"
                  onClick={envoyerCommande}
                  loading={chargement}
                  disabled={
                    !client.nom ||
                    !client.telephone ||
                    (client.livraison === "livraison" && !client.adresse)
                  }
                >
                  {!chargement && <><IconeWhatsApp /> Commander</>}
                </Btn>
              </div>
            </>
          )}

          {/* ── ÉTAPE 1 : Révision du panier ─────────────── */}
          {etape === "panier" && (
            <>
              {panier.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <div className="text-6xl mb-4">🛒</div>
                  <div className="font-semibold text-lg">Votre panier est vide</div>
                </div>
              ) : (
                <>
                  {/* Liste des articles */}
                  <div className="space-y-3">
                    {panier.map((item) => (
                      <div
                        key={item.id}
                        className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4"
                      >
                        <ImageProduit photo={item.photo} taille="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-800 text-sm truncate">
                            {item.nom}
                          </div>
                          <div className="text-orange-600 font-bold mt-1 text-sm">
                            {formatFCFA(item.prix_fcfa * item.quantite)}
                          </div>
                        </div>
                        {/* Contrôles quantité */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onModifierQty(item.id, -1)}
                            className="w-8 h-8 bg-white border-2 border-gray-200 rounded-full font-bold flex items-center justify-center hover:border-orange-400"
                          >−</button>
                          <span className="w-6 text-center font-black text-sm">
                            {item.quantite}
                          </span>
                          <button
                            onClick={() => onModifierQty(item.id, 1)}
                            className="w-8 h-8 bg-orange-500 text-white rounded-full font-bold flex items-center justify-center hover:bg-orange-600"
                          >+</button>
                        </div>
                        {/* Supprimer l'article */}
                        <button
                          onClick={() => onSupprimer(item.id)}
                          className="text-red-400 hover:text-red-600 text-xl ml-1"
                        >✕</button>
                      </div>
                    ))}
                  </div>

                  {/* Total affiché dans le panier */}
                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-5 text-white flex justify-between items-center">
                    <div>
                      <div className="text-orange-100 text-sm">Sous-total</div>
                      <div className="text-3xl font-black mt-1">
                        {formatFCFA(sousTotal)}
                      </div>
                    </div>
                    <div className="text-5xl">💰</div>
                  </div>

                  <Btn color="dark" full size="lg" onClick={() => setEtape("infos")}>
                    Commander →
                  </Btn>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ============================================================
//  PAGE : Catalogue Client (espace public)
//  Accessible sans connexion. Affiche le catalogue avec
//  recherche, filtres par catégorie et gestion du panier.
// ============================================================
function PageCatalogue() {
  const { produits, loading } = useProduits();
  const [panier,      setPanier]      = useState([]);
  const [panierOuvert, setPanierOuvert] = useState(false);
  const [categorie,   setCategorie]   = useState("Tous");
  const [recherche,   setRecherche]   = useState("");

  // Calculs panier
  const nbPanier     = panier.reduce((s, i) => s + i.quantite, 0);
  const totalPanier  = panier.reduce((s, i) => s + i.prix_fcfa * i.quantite, 0);

  // Construction de la liste des catégories disponibles
  const categories = ["Tous", ...new Set(produits.map((p) => p.categorie))];
  const iconesCats = { Épicerie: "🥫", Hygiène: "🧴", Boissons: "🥤", Conserves: "🐟" };

  // Filtrage des produits selon recherche et catégorie
  const produitsFiltres = produits.filter(
    (p) =>
      (categorie === "Tous" || p.categorie === categorie) &&
      (p.nom.toLowerCase().includes(recherche.toLowerCase()) ||
        p.categorie.toLowerCase().includes(recherche.toLowerCase()))
  );

  /** Ajoute ou retire un produit du panier (delta = +1 ou -1) */
  const modifierPanier = (produit, delta) => {
    setPanier((prev) => {
      const existant = prev.find((i) => i.id === produit.id);
      if (existant) {
        const nouvelleQty = existant.quantite + delta;
        if (nouvelleQty <= 0) return prev.filter((i) => i.id !== produit.id);
        return prev.map((i) =>
          i.id === produit.id ? { ...i, quantite: nouvelleQty } : i
        );
      }
      return delta > 0 ? [...prev, { ...produit, quantite: 1 }] : prev;
    });
  };

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Panneau panier latéral */}
      {panierOuvert && (
        <PanierDrawer
          panier={panier}
          onFermer={() => setPanierOuvert(false)}
          onModifierQty={(id, d) =>
            modifierPanier(produits.find((p) => p.id === id), d)
          }
          onSupprimer={(id) =>
            setPanier((prev) => prev.filter((i) => i.id !== id))
          }
          onCommandeEnvoyee={() => setPanier([])}
        />
      )}

      {/* ── En-tête avec recherche et catégories ─────── */}
      <div className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white sticky top-0 z-40 shadow-xl">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {/* Ligne titre + icône panier */}
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xl font-black leading-tight">
                🏪 {BOUTIQUE.nom}
              </div>
              <div className="text-orange-100 text-xs mt-0.5">{BOUTIQUE.slogan}</div>
            </div>
            <button
              onClick={() => setPanierOuvert(true)}
              className="relative bg-white/20 hover:bg-white/30 backdrop-blur rounded-2xl p-3 transition-all"
            >
              <span className="text-2xl">🛒</span>
              {nbPanier > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
                  {nbPanier}
                </span>
              )}
            </button>
          </div>

          {/* Barre de recherche */}
          <div className="mt-3 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un produit…"
              className="w-full pl-10 pr-4 py-3 rounded-2xl text-gray-800 font-medium text-base bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>

          {/* Filtres catégories — défilables horizontalement */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategorie(cat)}
                className={`whitespace-nowrap px-4 py-2 rounded-2xl text-sm font-bold transition-all flex-shrink-0 ${
                  categorie === cat
                    ? "bg-white text-orange-600 shadow-md"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                {iconesCats[cat] || "📦"} {cat}
              </button>
            ))}
          </div>

          {/* Info frais de livraison */}
          {FRAIS_LIVRAISON > 0 && (
            <div className="mt-2 text-xs text-orange-100 font-medium">
              🚚 Livraison disponible — {formatFCFA(FRAIS_LIVRAISON)} forfait
            </div>
          )}
        </div>
      </div>

      {/* ── Grille de produits ─────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-28">
        {loading ? (
          <Spinner texte="Chargement du catalogue…" />
        ) : (
          <>
            <div className="text-sm text-gray-500 mb-4 font-medium">
              {produitsFiltres.length} produit{produitsFiltres.length > 1 ? "s" : ""}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {produitsFiltres.map((p) => {
                const dansPanier = panier.find((i) => i.id === p.id)?.quantite || 0;
                const enRupture  = p.stock_cartons === 0;

                return (
                  <Card
                    key={p.id}
                    className={`overflow-hidden transition-all ${
                      enRupture ? "opacity-60" : "hover:shadow-md"
                    }`}
                  >
                    {/* Zone image (emoji ou photo) */}
                    <div
                      className={`relative flex items-center justify-center ${
                        enRupture
                          ? "bg-gray-100"
                          : "bg-gradient-to-br from-orange-50 to-amber-100"
                      }`}
                      style={{ minHeight: 120 }}
                    >
                      {estUrl(p.photo) ? (
                        <img
                          src={p.photo}
                          alt={p.nom}
                          className="w-full h-32 object-cover"
                        />
                      ) : (
                        <div className="text-5xl py-5">{p.photo || "📦"}</div>
                      )}

                      {/* Badge stock faible */}
                      {!enRupture && p.stock_cartons <= SEUIL_ALERTE_STOCK && (
                        <span className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          {p.stock_cartons} restant{p.stock_cartons > 1 ? "s" : ""}
                        </span>
                      )}

                      {/* Badge rupture de stock */}
                      {enRupture && (
                        <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          Rupture
                        </span>
                      )}
                    </div>

                    {/* Informations produit */}
                    <div className="p-4">
                      <div className="font-black text-gray-800 text-sm leading-tight">
                        {p.nom}
                      </div>
                      <div className="text-gray-400 text-xs mt-1 truncate">
                        {p.description}
                      </div>
                      <div className="text-orange-600 font-black text-lg mt-2">
                        {formatFCFA(p.prix_fcfa)}
                      </div>
                      <div className="text-gray-400 text-xs">/ {p.unite}</div>

                      {/* Contrôles ajout au panier */}
                      {!enRupture && (
                        dansPanier > 0 ? (
                          <div className="flex items-center justify-between mt-3 bg-orange-50 rounded-xl p-2">
                            <button
                              onClick={() => modifierPanier(p, -1)}
                              className="w-8 h-8 bg-white rounded-full font-bold text-lg flex items-center justify-center shadow hover:bg-gray-50"
                            >−</button>
                            <span className="font-black text-orange-600">
                              {dansPanier}
                            </span>
                            <button
                              onClick={() => modifierPanier(p, 1)}
                              className="w-8 h-8 bg-orange-500 text-white rounded-full font-bold text-lg flex items-center justify-center hover:bg-orange-600"
                            >+</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => modifierPanier(p, 1)}
                            className="mt-3 w-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white py-2.5 rounded-xl font-bold text-sm transition-all"
                          >
                            + Ajouter
                          </button>
                        )
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Message si aucun résultat */}
            {produitsFiltres.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <div className="text-5xl mb-3">🔍</div>
                <div className="font-semibold">Aucun produit trouvé</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bandeau panier fixe en bas (visible si panier non vide) */}
      {nbPanier > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-30 pb-20">
          <button
            onClick={() => setPanierOuvert(true)}
            className="max-w-2xl mx-auto flex w-full bg-gray-900 text-white rounded-2xl px-6 py-4 items-center justify-between shadow-2xl hover:bg-gray-800 transition-all active:scale-[0.98]"
          >
            <div className="bg-orange-500 text-white rounded-xl px-3 py-1 font-black text-sm">
              {nbPanier}
            </div>
            <div className="font-black text-base">Voir mon panier 🛒</div>
            <div className="font-black text-orange-400">{formatFCFA(totalPanier)}</div>
          </button>
        </div>
      )}
    </div>
  );
}


// ============================================================
//  MODAL : Formulaire Produit (création + modification)
//  Mode "emoji" : sélection dans une grille d'emojis
//  Mode "photo" : prise de photo ou sélection galerie
// ============================================================
function ModalProduit({ produit, onFermer, onSauvegarder }) {
  const { uploadPhoto } = useProduits();

  // Initialise le formulaire avec les données du produit
  // ou avec des valeurs vides pour un nouveau produit
  const [form, setForm] = useState(
    produit
      ? {
          ...produit,
          prix_fcfa:     String(produit.prix_fcfa),
          stock_cartons: String(produit.stock_cartons),
        }
      : {
          nom: "", categorie: "Épicerie", prix_fcfa: "", stock_cartons: "",
          unite: "carton", description: "", photo: "🥫",
        }
  );

  // "upload" si la photo actuelle est une URL, "emoji" sinon
  const [modePhoto,   setModePhoto]   = useState(
    estUrl(produit?.photo) ? "upload" : "emoji"
  );
  const [fichierPhoto, setFichierPhoto] = useState(null); // File à uploader
  const [sauvegarde,   setSauvegarde]   = useState(false);

  const definir = (cle, valeur) => setForm((p) => ({ ...p, [cle]: valeur }));

  const sauvegarder = async () => {
    setSauvegarde(true);
    try {
      let photoFinale = form.photo;

      // Si l'admin a sélectionné une nouvelle photo, on l'uploade
      if (fichierPhoto && modePhoto === "upload") {
        photoFinale = await uploadPhoto(fichierPhoto, form.id);
      }

      await onSauvegarder({ ...form, photo: photoFinale });
    } catch (e) {
      alert("Erreur lors de la sauvegarde : " + e.message);
    } finally {
      setSauvegarde(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="bg-white rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête modal */}
        <div className="bg-gray-900 p-5 rounded-t-3xl text-white flex justify-between items-center sticky top-0 z-10">
          <div className="font-black text-lg">
            {produit ? "✏️ Modifier le produit" : "➕ Nouveau produit"}
          </div>
          <button onClick={onFermer} className="text-gray-400 hover:text-white text-2xl">
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Toggle mode photo : Emoji ou Upload */}
          <div className="grid grid-cols-2 gap-2">
            {[["emoji", "😊 Emoji"], ["upload", "📷 Photo"]].map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setModePhoto(mode)}
                className={`py-3 rounded-2xl font-bold text-sm transition-all ${
                  modePhoto === mode
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sélecteur d'emojis */}
          {modePhoto === "emoji" && (
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">
                Choisir un emoji
              </label>
              <div className="flex flex-wrap gap-2">
                {EMOJIS_PRODUITS.map((e) => (
                  <button
                    key={e}
                    onClick={() => definir("photo", e)}
                    className={`text-2xl w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      form.photo === e
                        ? "bg-orange-100 ring-2 ring-orange-500 scale-110"
                        : "bg-gray-100 hover:bg-orange-50"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Upload de photo */}
          {modePhoto === "upload" && (
            <UploadPhoto
              photoActuelle={estUrl(form.photo) ? form.photo : null}
              onFichierSelectionne={(fichier) => {
                setFichierPhoto(fichier);
                if (!fichier) definir("photo", "📦"); // Remet emoji si suppression
              }}
            />
          )}

          {/* Champs texte et numériques */}
          {[
            ["nom",          "Nom du produit *",    "text",   "Ex: Sucre en poudre"],
            ["description",  "Description",          "text",   "Ex: Carton 50 sachets × 1 kg"],
            ["prix_fcfa",    "Prix (FCFA) *",        "number", "28500"],
            ["stock_cartons","Quantité en stock *",  "number", "12"],
          ].map(([cle, label, type, placeholder]) => (
            <div key={cle}>
              <label className="block text-sm font-bold text-gray-600 mb-2">
                {label}
              </label>
              <input
                type={type}
                value={form[cle]}
                onChange={(e) => definir(cle, e.target.value)}
                placeholder={placeholder}
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-base font-medium focus:border-orange-400 focus:outline-none"
              />
            </div>
          ))}

          {/* Sélecteur de catégorie */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">
              Catégorie
            </label>
            <select
              value={form.categorie}
              onChange={(e) => definir("categorie", e.target.value)}
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-base font-medium focus:border-orange-400 focus:outline-none bg-white"
            >
              {["Épicerie", "Hygiène", "Boissons", "Conserves", "Autre"].map(
                (cat) => <option key={cat}>{cat}</option>
              )}
            </select>
          </div>

          {/* Sélecteur d'unité */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">
              Unité de vente
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["carton", "sac", "pièce"].map((u) => (
                <button
                  key={u}
                  onClick={() => definir("unite", u)}
                  className={`py-3 rounded-2xl font-bold text-sm transition-all ${
                    form.unite === u
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Boutons Annuler / Enregistrer */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Btn color="ghost" onClick={onFermer}>Annuler</Btn>
            <Btn
              color="orange"
              onClick={sauvegarder}
              loading={sauvegarde}
              disabled={!form.nom || !form.prix_fcfa || !form.stock_cartons}
            >
              {!sauvegarde && "Enregistrer ✓"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}


// ============================================================
//  ONGLET ADMIN : Historique des Factures
//  Lecture seule. Les factures ne peuvent pas être modifiées
//  ni supprimées (aucune policy UPDATE/DELETE dans Supabase).
// ============================================================
function OngletFactures({ ouvrirFacture }) {
  const [factures, setFactures] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    supabase
      .from("factures")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setFactures(data || []);
        setLoading(false);
      });
  }, []);

  const caTotal = factures.reduce((s, f) => s + f.total_fcfa, 0);

  return (
    <div className="space-y-4">
      {/* Résumé */}
      <div className="flex justify-between items-center">
        <div className="text-lg font-black text-gray-800">
          {factures.length} facture{factures.length > 1 ? "s" : ""}
        </div>
        <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-sm font-bold">
          Total : {formatFCFA(caTotal)}
        </div>
      </div>

      {/* Note de traçabilité */}
      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-sm text-amber-700 font-medium">
        🔒 <strong>Lecture seule</strong> — Ces factures ne peuvent pas être
        modifiées ni supprimées. La traçabilité comptable est garantie par la
        base de données.
      </div>

      {loading ? (
        <Spinner texte="Chargement des factures…" />
      ) : factures.length === 0 ? (
        <Card className="p-12 text-center text-gray-400">
          <div className="text-5xl mb-3">🧾</div>
          <div className="font-semibold">Aucune facture générée</div>
        </Card>
      ) : (
        factures.map((f) => {
          const articles =
            typeof f.articles_json === "string"
              ? JSON.parse(f.articles_json)
              : (f.articles_json || []);

          return (
            <Card key={f.id} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-black text-gray-800">{f.client_nom}</div>
                  <div className="text-gray-500 text-sm">📞 {f.telephone}</div>
                  <div className="text-gray-400 text-xs mt-1">
                    {fmtDate(f.created_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-orange-600 text-lg">
                    {formatFCFA(f.total_fcfa)}
                  </div>
                  <Badge color="green">N° {f.commande_id}</Badge>
                </div>
              </div>

              {/* Boutons WhatsApp + Imprimer */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const msg = construireMessageWhatsApp({
                      client_nom:      f.client_nom,
                      telephone:       f.telephone,
                      articles,
                      total_articles:  articles.reduce(
                        (s, a) => s + (a.prix_fcfa ?? a.prix) * a.quantite, 0
                      ),
                      frais_livraison: f.frais_livraison ?? 0,
                      total_fcfa:      f.total_fcfa,
                      livraison:       f.livraison,
                      adresse:         f.adresse,
                      commandeId:      f.commande_id,
                    });
                    ouvrirWhatsApp(msg);
                  }}
                  className="flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5b] text-white py-2.5 px-3 rounded-xl text-sm font-bold transition-all"
                >
                  <IconeWhatsApp className="w-4 h-4" /> WhatsApp
                </button>
                <button
                  onClick={() => ouvrirFacture({ ...f, id: f.commande_id })}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 px-3 rounded-xl text-sm font-bold transition-all"
                >
                  🖨️ Imprimer
                </button>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}


// ============================================================
//  PAGE : Espace Admin
//  Accessible uniquement aux utilisateurs connectés.
//  4 onglets : Tableau de bord | Stock | Commandes | Factures
// ============================================================
function PageAdmin() {
  const { user, logout } = useAuth();
  const {
    produits, loading: chargeProd,
    sauvegarder, desactiver, recharger: rechargeProd,
  } = useProduits();
  const {
    commandes, loading: chargeCmd,
    valider, recharger: rechargeCmd,
  } = useCommandes();

  const [onglet,        setOnglet]        = useState("dashboard");
  const [factureOuverte, setFactureOuverte] = useState(null);
  const [editProduit,   setEditProduit]   = useState(null);  // produit en cours d'édition
  const [ajouterProduit, setAjouterProduit] = useState(false);
  const [enValidation,  setEnValidation]  = useState(null);  // ID de commande en cours
  const [toast,         afficherToast]    = useToast();

  // Données calculées pour le tableau de bord
  const commandesAttente  = commandes.filter((c) => c.statut === "en_attente");
  const commandesValidees = commandes.filter((c) => c.statut === "validee");
  const caAujourdhui = commandesValidees
    .filter((c) => new Date(c.created_at).toDateString() === new Date().toDateString())
    .reduce((s, c) => s + c.total_fcfa, 0);
  const alertesStock = produits.filter((p) => p.stock_cartons < SEUIL_ALERTE_STOCK);

  /** Valide une commande via la transaction PostgreSQL atomique */
  const traiterValidation = async (cmd) => {
    setEnValidation(cmd.id);
    try {
      await valider(cmd.id, user.id);
      await rechargeProd(); // Rafraîchit les stocks décrémentés

      afficherToast(`Commande ${cmd.id} validée ! Facture générée ✓`);

      // Charge et affiche la facture créée
      const { data } = await supabase
        .from("factures")
        .select("*")
        .eq("commande_id", cmd.id)
        .single();
      if (data) setFactureOuverte({ ...data, id: cmd.id });
    } catch (e) {
      afficherToast(e.message, "error");
    } finally {
      setEnValidation(null);
    }
  };

  /** Sauvegarde un produit (nouveau ou modifié) */
  const traiterSauvegardeProduit = async (form) => {
    try {
      await sauvegarder({
        id:            form.id,
        nom:           form.nom,
        categorie:     form.categorie,
        prix_fcfa:     Number(form.prix_fcfa),
        stock_cartons: Number(form.stock_cartons),
        unite:         form.unite,
        description:   form.description,
        photo:         form.photo,
      });
      setAjouterProduit(false);
      setEditProduit(null);
      afficherToast(form.id ? "Produit modifié !" : "Produit ajouté !");
    } catch (e) {
      afficherToast(e.message, "error");
    }
  };

  /** Désactive (suppression douce) un produit */
  const traiterDesactivation = async (id) => {
    if (!confirm("Désactiver ce produit ? Il ne sera plus visible dans le catalogue.")) return;
    try {
      await desactiver(id);
      afficherToast("Produit désactivé");
    } catch (e) {
      afficherToast(e.message, "error");
    }
  };

  // Configuration des onglets
  const onglets = [
    { id: "dashboard",     label: "Tableau de bord",  ico: "📊" },
    { id: "stock",         label: "Stock",            ico: "📦" },
    {
      id: "commandes",
      label: `Commandes${commandesAttente.length > 0 ? ` (${commandesAttente.length})` : ""}`,
      ico: "📋",
    },
    { id: "factures_hist", label: "Factures",         ico: "🧾" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast toast={toast} />

      {/* Modales */}
      {factureOuverte && (
        <FactureModal commande={factureOuverte} onFermer={() => setFactureOuverte(null)} />
      )}
      {ajouterProduit && (
        <ModalProduit onFermer={() => setAjouterProduit(false)} onSauvegarder={traiterSauvegardeProduit} />
      )}
      {editProduit && (
        <ModalProduit produit={editProduit} onFermer={() => setEditProduit(null)} onSauvegarder={traiterSauvegardeProduit} />
      )}

      {/* ── En-tête Admin avec voyant de connexion ─── */}
      <div className="bg-gray-900 text-white px-4 py-4 sticky top-0 z-30 shadow-xl">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-xl font-black leading-tight">⚙️ Administration</div>
                <div className="text-gray-400 text-xs">{user?.email}</div>
              </div>
              {/* Voyant de connexion vert/rouge */}
              <div className="bg-gray-800 rounded-xl px-3 py-1.5">
                <VoyantConnexion />
              </div>
            </div>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-red-400 text-sm font-semibold transition-colors"
            >
              🚪 Déconnexion
            </button>
          </div>

          {/* Navigation par onglets */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            {onglets.map((o) => (
              <button
                key={o.id}
                onClick={() => setOnglet(o.id)}
                className={`whitespace-nowrap px-5 py-2.5 rounded-2xl text-sm font-bold transition-all flex-shrink-0 ${
                  onglet === o.id
                    ? "bg-orange-500 text-white"
                    : "bg-white/10 text-gray-300 hover:bg-white/20"
                }`}
              >
                {o.ico} {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 pb-28">

        {/* ══════════════════════════════════════════════
            ONGLET : Tableau de bord
        ══════════════════════════════════════════════ */}
        {onglet === "dashboard" && (
          <div className="space-y-5">
            {chargeProd || chargeCmd ? (
              <Spinner />
            ) : (
              <>
                {/* Métriques principales */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-5 bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
                    <div className="text-3xl font-black">
                      {new Intl.NumberFormat("fr-FR").format(caAujourdhui)}
                    </div>
                    <div className="text-orange-200 text-xs">FCFA</div>
                    <div className="text-orange-100 text-sm mt-2 font-semibold">
                      💰 CA aujourd'hui
                    </div>
                  </Card>
                  <Card className="p-5 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
                    <div className="text-5xl font-black">{commandesAttente.length}</div>
                    <div className="text-emerald-100 text-sm mt-2 font-semibold">
                      📋 À préparer
                    </div>
                  </Card>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-5">
                    <div className="text-gray-400 text-xs font-bold uppercase mb-1">
                      Produits actifs
                    </div>
                    <div className="text-4xl font-black text-gray-800">
                      {produits.length}
                    </div>
                  </Card>
                  <Card className="p-5">
                    <div className="text-gray-400 text-xs font-bold uppercase mb-1">
                      Total commandes
                    </div>
                    <div className="text-4xl font-black text-gray-800">
                      {commandes.length}
                    </div>
                  </Card>
                </div>

                {/* Alertes stock critiques */}
                {alertesStock.length > 0 && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                    <div className="font-black text-red-700 mb-3">
                      🚨 {alertesStock.length} stock{alertesStock.length > 1 ? "s" : ""} critique{alertesStock.length > 1 ? "s" : ""} !
                    </div>
                    {alertesStock.map((p) => (
                      <div
                        key={p.id}
                        className="flex justify-between items-center py-2 border-b border-red-100 last:border-0"
                      >
                        <span className="text-red-700 font-semibold text-sm">
                          {p.photo} {p.nom}
                        </span>
                        <span className="text-red-600 font-black text-sm">
                          {p.stock_cartons} restant{p.stock_cartons !== 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Aperçu rapide des stocks */}
                <Card className="p-5">
                  <div className="text-sm font-black text-gray-500 uppercase mb-4">
                    📦 Aperçu des stocks
                  </div>
                  <div className="space-y-2">
                    {produits.slice(0, 6).map((p) => (
                      <div
                        key={p.id}
                        className={`flex justify-between items-center p-3 rounded-xl ${
                          p.stock_cartons < SEUIL_ALERTE_STOCK ? "bg-red-50" : "bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <ImageProduit photo={p.photo} taille="sm" />
                          <span className="font-semibold text-sm">{p.nom}</span>
                        </div>
                        <span className={`font-black text-sm ${
                          p.stock_cartons < SEUIL_ALERTE_STOCK
                            ? "text-red-600" : "text-emerald-600"
                        }`}>
                          {p.stock_cartons < SEUIL_ALERTE_STOCK && "⚠️ "}
                          {p.stock_cartons}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}
          </div>
        )}


        {/* ══════════════════════════════════════════════
            ONGLET : Gestion du Stock
        ══════════════════════════════════════════════ */}
        {onglet === "stock" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-lg font-black text-gray-800">
                {produits.length} produit{produits.length > 1 ? "s" : ""}
              </div>
              <Btn color="orange" size="sm" onClick={() => setAjouterProduit(true)}>
                + Nouveau produit
              </Btn>
            </div>

            {chargeProd ? (
              <Spinner texte="Chargement des produits…" />
            ) : (
              produits.map((p) => (
                <Card
                  key={p.id}
                  className={`p-4 ${
                    p.stock_cartons < SEUIL_ALERTE_STOCK ? "bg-red-50 border-red-200" : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <ImageProduit photo={p.photo} taille="md" />
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-gray-800">{p.nom}</div>
                      <div className="text-gray-400 text-xs truncate">{p.description}</div>
                      <div className="flex flex-wrap gap-3 mt-1.5">
                        <span className="text-orange-600 font-bold text-sm">
                          {formatFCFA(p.prix_fcfa)}
                        </span>
                        <span className={`font-bold text-sm ${
                          p.stock_cartons < SEUIL_ALERTE_STOCK
                            ? "text-red-600" : "text-emerald-600"
                        }`}>
                          {p.stock_cartons < SEUIL_ALERTE_STOCK && "⚠️ "}
                          {p.stock_cartons} {p.unite}{p.stock_cartons !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setEditProduit(p)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm font-bold"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => traiterDesactivation(p.id)}
                        className="bg-red-100 hover:bg-red-200 text-red-600 px-3 py-2 rounded-xl text-sm font-bold"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}


        {/* ══════════════════════════════════════════════
            ONGLET : Gestion des Commandes
        ══════════════════════════════════════════════ */}
        {onglet === "commandes" && (
          <div className="space-y-4">
            {chargeCmd ? (
              <Spinner texte="Chargement des commandes…" />
            ) : (
              <>
                <div className="text-lg font-black text-gray-800">
                  {commandesAttente.length} commande{commandesAttente.length > 1 ? "s" : ""} en attente
                </div>

                {/* Commandes en attente */}
                {commandesAttente.length === 0 ? (
                  <Card className="p-12 text-center text-gray-400">
                    <div className="text-5xl mb-3">🎉</div>
                    <div className="font-semibold">Aucune commande en attente</div>
                  </Card>
                ) : (
                  commandesAttente.map((cmd) => {
                    const articles =
                      typeof cmd.articles_json === "string"
                        ? JSON.parse(cmd.articles_json)
                        : (cmd.articles_json || []);
                    const frais    = cmd.frais_livraison ?? 0;
                    const sousTotal = articles.reduce(
                      (s, a) => s + (a.prix_fcfa ?? a.prix) * a.quantite, 0
                    );

                    return (
                      <Card key={cmd.id} className="p-5 space-y-4">
                        {/* En-tête commande */}
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-black text-gray-800 text-lg">
                              {cmd.client_nom}
                            </div>
                            <div className="text-gray-500 text-sm">
                              📞 {cmd.telephone}
                            </div>
                            <div className="text-gray-500 text-sm">
                              {cmd.livraison === "livraison" ? "🚚 Livraison" : "🏪 Retrait"}
                            </div>
                            <div className="text-gray-400 text-xs mt-1">
                              {fmtDate(cmd.created_at)}
                            </div>
                          </div>
                          <Badge color="orange">{cmd.id}</Badge>
                        </div>

                        {/* Détail articles + frais */}
                        <div className="bg-gray-50 rounded-2xl p-3 space-y-1.5">
                          {articles.map((a, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-gray-700 font-medium">
                                {a.nom} × {a.quantite}
                              </span>
                              <span className="font-bold">
                                {formatFCFA((a.prix_fcfa ?? a.prix) * a.quantite)}
                              </span>
                            </div>
                          ))}
                          {frais > 0 && (
                            <div className="flex justify-between text-sm text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1.5">
                              <span className="font-semibold">🚚 Frais livraison</span>
                              <span className="font-bold">+ {formatFCFA(frais)}</span>
                            </div>
                          )}
                          <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-black text-base">
                            <span>TOTAL</span>
                            <span className="text-orange-600">
                              {formatFCFA(cmd.total_fcfa)}
                            </span>
                          </div>
                        </div>

                        {/* Adresse de livraison */}
                        {cmd.adresse && (
                          <div className="text-sm text-gray-600 bg-blue-50 rounded-xl px-3 py-2">
                            📍 {cmd.adresse}
                          </div>
                        )}

                        {/* Bouton contacter le client avant validation */}
                        <button
                          onClick={() => {
                            const msg = construireMessageWhatsApp({
                              client_nom:      cmd.client_nom,
                              telephone:       cmd.telephone,
                              articles,
                              total_articles:  sousTotal,
                              frais_livraison: frais,
                              total_fcfa:      cmd.total_fcfa,
                              livraison:       cmd.livraison,
                              adresse:         cmd.adresse,
                              commandeId:      cmd.id,
                            });
                            ouvrirWhatsApp(msg);
                          }}
                          className="w-full flex items-center justify-center gap-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] border border-[#25D366]/30 py-3 rounded-2xl font-bold text-sm transition-all"
                        >
                          <IconeWhatsApp className="w-4 h-4" />
                          Contacter le client via WhatsApp
                        </button>

                        {/* Bouton de validation — déclenche la transaction atomique */}
                        <Btn
                          color="green"
                          full
                          size="lg"
                          loading={enValidation === cmd.id}
                          onClick={() => traiterValidation(cmd)}
                        >
                          {enValidation !== cmd.id && "✅ Valider et Générer la Facture"}
                        </Btn>
                      </Card>
                    );
                  })
                )}

                {/* Commandes validées (historique) */}
                {commandesValidees.length > 0 && (
                  <>
                    <div className="text-sm font-black text-gray-400 uppercase mt-6 mb-3">
                      Commandes validées ({commandesValidees.length})
                    </div>
                    {commandesValidees.map((cmd) => (
                      <Card key={cmd.id} className="p-4 opacity-75">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-bold text-gray-700">{cmd.client_nom}</div>
                            <div className="text-gray-400 text-xs">
                              {fmtDate(cmd.created_at)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-emerald-600">
                              {formatFCFA(cmd.total_fcfa)}
                            </span>
                            <Badge color="green">✓</Badge>
                            {/* Bouton pour rouvrir la facture */}
                            <button
                              onClick={async () => {
                                const { data } = await supabase
                                  .from("factures")
                                  .select("*")
                                  .eq("commande_id", cmd.id)
                                  .single();
                                if (data) setFactureOuverte({ ...data, id: cmd.id });
                              }}
                              className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold"
                            >
                              🧾
                            </button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}


        {/* ══════════════════════════════════════════════
            ONGLET : Historique des Factures (lecture seule)
        ══════════════════════════════════════════════ */}
        {onglet === "factures_hist" && (
          <OngletFactures ouvrirFacture={setFactureOuverte} />
        )}

      </div>
    </div>
  );
}


// ============================================================
//  COMPOSANT RACINE : AppContent
//  Gère la navigation entre les trois vues :
//  - PageCatalogue : espace public (clients)
//  - PageConnexion : formulaire de login
//  - PageAdmin     : espace protégé (admin connecté)
// ============================================================
function AppContent() {
  const { user, loading } = useAuth();
  const [vue, setVue] = useState("catalogue"); // catalogue | connexion | admin

  // Redirige automatiquement vers admin après une connexion réussie
  useEffect(() => {
    if (user && vue === "connexion") setVue("admin");
  }, [user]);

  // Écran de chargement initial (vérification de la session)
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
          <div className="text-white font-semibold">Chargement…</div>
        </div>
      </div>
    );
  }

  const allerAdmin = () => (user ? setVue("admin") : setVue("connexion"));

  return (
    <div>
      {/* Vues principales */}
      {vue === "catalogue" && <PageCatalogue />}
      {vue === "connexion" && <PageConnexion onRetour={() => setVue("catalogue")} />}
      {vue === "admin" && user  && <PageAdmin />}
      {vue === "admin" && !user && <PageConnexion onRetour={() => setVue("catalogue")} />}

      {/* Navigation flottante (toujours visible) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-gray-900/95 backdrop-blur-sm rounded-full px-3 py-2 shadow-2xl border border-white/10">
        <button
          onClick={() => setVue("catalogue")}
          className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
            vue === "catalogue"
              ? "bg-orange-500 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          🛍️ Boutique
        </button>
        <button
          onClick={allerAdmin}
          className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
            vue === "admin" || vue === "connexion"
              ? "bg-orange-500 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          {user ? "⚙️ Admin" : "🔐 Admin"}
        </button>
      </div>
    </div>
  );
}


// ============================================================
//  EXPORT PAR DÉFAUT — Point d'entrée de l'application
//  AuthProvider enveloppe tout pour partager la session
//  de connexion dans tous les composants enfants.
// ============================================================
export default function BoutiqueApp() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
