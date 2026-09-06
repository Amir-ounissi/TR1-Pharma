import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "./src/lib/supabase";

type BrandContextRow = {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  role_key: string;
};

type BrandContext = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

const ACTIVE_BRAND_STORAGE_KEY = "tr1_mobile_active_brand";

const palette = {
  ink: "#111827",
  muted: "#667085",
  border: "#E4E7EC",
  surface: "#FFFFFF",
  background: "#F7F8FA",
  accent: "#3B5BDB",
  accentSoft: "#EEF2FF",
  success: "#067647",
  successSoft: "#ECFDF3",
  danger: "#B42318",
};

async function fetchBrandContexts(): Promise<BrandContext[]> {
  let response = await supabase.rpc("get_my_brand_contexts");

  if (response.error?.code === "PGRST303") {
    await new Promise((resolve) => setTimeout(resolve, 700));
    response = await supabase.rpc("get_my_brand_contexts");
  }

  if (response.error) throw response.error;

  return ((response.data ?? []) as BrandContextRow[]).map((row) => ({
    id: row.brand_id,
    name: row.brand_name,
    slug: row.brand_slug,
    role: row.role_key,
  }));
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [contexts, setContexts] = useState<BrandContext[]>([]);
  const [contextsPending, setContextsPending] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);

  const activeBrand = useMemo(
    () => contexts.find((context) => context.id === activeBrandId) ?? null,
    [activeBrandId, contexts],
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setBooting(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setContexts([]);
        setActiveBrandId(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    setContextsPending(true);
    setContextError(null);

    Promise.all([fetchBrandContexts(), AsyncStorage.getItem(ACTIVE_BRAND_STORAGE_KEY)])
      .then(([availableContexts, savedBrandId]) => {
        if (cancelled) return;
        setContexts(availableContexts);
        const savedIsValid = availableContexts.some((context) => context.id === savedBrandId);
        if (savedIsValid && savedBrandId) {
          setActiveBrandId(savedBrandId);
        } else if (availableContexts.length === 1) {
          setActiveBrandId(availableContexts[0]?.id ?? null);
        } else {
          setActiveBrandId(null);
        }
      })
      .catch(() => {
        if (!cancelled) setContextError("Impossible de charger vos marques TR1.");
      })
      .finally(() => {
        if (!cancelled) setContextsPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  async function signIn() {
    if (!email.trim() || !password) return;
    setAuthPending(true);
    setAuthError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) setAuthError("Email ou mot de passe incorrect.");
    setAuthPending(false);
  }

  async function chooseBrand(brandId: string) {
    await AsyncStorage.setItem(ACTIVE_BRAND_STORAGE_KEY, brandId);
    setActiveBrandId(brandId);
  }

  async function signOut() {
    await AsyncStorage.removeItem(ACTIVE_BRAND_STORAGE_KEY);
    await supabase.auth.signOut();
  }

  if (booting) {
    return <LoadingScreen label="Ouverture de TR1 Pharma" />;
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.loginContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>TR1</Text>
            </View>
            <Text style={styles.loginTitle}>TR1 Pharma</Text>
            <Text style={styles.loginSubtitle}>Le terrain, dans votre poche.</Text>

            <View style={styles.formCard}>
              <Text style={styles.label}>Email professionnel</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="vous@marque.fr"
                placeholderTextColor="#98A2B3"
                style={styles.input}
              />

              <Text style={styles.label}>Mot de passe</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#98A2B3"
                style={styles.input}
              />

              {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

              <Pressable
                accessibilityRole="button"
                disabled={authPending || !email.trim() || !password}
                onPress={signIn}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (authPending || !email.trim() || !password) && styles.primaryButtonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                {authPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Se connecter</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (contextsPending) {
    return <LoadingScreen label="Chargement de votre espace" />;
  }

  if (contextError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Connexion TR1 incomplète</Text>
          <Text style={styles.centeredMuted}>{contextError}</Text>
          <Pressable style={styles.secondaryButton} onPress={signOut}>
            <Text style={styles.secondaryButtonText}>Se déconnecter</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!activeBrand) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.screenContainer}>
          <Text style={styles.eyebrow}>ESPACE MOBILE</Text>
          <Text style={styles.screenTitle}>Choisir une marque</Text>
          <Text style={styles.screenSubtitle}>
            TR1 n’affichera que les données auxquelles votre compte a accès.
          </Text>

          <View style={styles.listGap}>
            {contexts.map((context) => (
              <Pressable
                key={context.id}
                onPress={() => chooseBrand(context.id)}
                style={({ pressed }) => [styles.brandCard, pressed && styles.buttonPressed]}
              >
                <View>
                  <Text style={styles.brandCardTitle}>{context.name}</Text>
                  <Text style={styles.brandCardMeta}>{context.role}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>

          {contexts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Aucune marque accessible</Text>
              <Text style={styles.emptyText}>
                Votre compte est authentifié mais ne possède pas encore d’accès marque actif.
              </Text>
            </View>
          ) : null}

          <Pressable style={styles.linkButton} onPress={signOut}>
            <Text style={styles.linkButtonText}>Se déconnecter</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.screenContainer}>
        <View style={styles.homeHeader}>
          <View>
            <Text style={styles.eyebrow}>TR1 TERRAIN</Text>
            <Text style={styles.homeTitle}>{activeBrand.name}</Text>
            <Text style={styles.homeMeta}>{activeBrand.role}</Text>
          </View>
          {contexts.length > 1 ? (
            <Pressable onPress={() => setActiveBrandId(null)} style={styles.switchButton}>
              <Text style={styles.switchButtonText}>Changer</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>AUJOURD’HUI</Text>
          <Text style={styles.heroTitle}>Votre journée terrain commence ici.</Text>
          <Text style={styles.heroText}>
            Missions, pharmacies prioritaires et commandes seront regroupées dans cet écran.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.actionGrid}>
          <ActionCard title="Scanner une commande" subtitle="Photo → analyse → validation" featured />
          <ActionCard title="Pharmacies" subtitle="Portefeuille et recherche" />
          <ActionCard title="Missions" subtitle="Priorités terrain" />
          <ActionCard title="Agenda" subtitle="Visites et relances" />
        </View>

        <View style={styles.securityCard}>
          <View style={styles.securityDot} />
          <View style={styles.flex}>
            <Text style={styles.securityTitle}>Isolation marque active</Text>
            <Text style={styles.securityText}>
              Le mobile utilise votre session Supabase et les accès TR1 existants. Aucun service_role n’est embarqué.
            </Text>
          </View>
        </View>

        <Pressable style={styles.linkButton} onPress={signOut}>
          <Text style={styles.linkButtonText}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.loadingText}>{label}</Text>
      </View>
    </SafeAreaView>
  );
}

function ActionCard({
  title,
  subtitle,
  featured = false,
}: {
  title: string;
  subtitle: string;
  featured?: boolean;
}) {
  return (
    <View style={[styles.actionCard, featured && styles.actionCardFeatured]}>
      <Text style={[styles.actionTitle, featured && styles.actionTitleFeatured]}>{title}</Text>
      <Text style={[styles.actionSubtitle, featured && styles.actionSubtitleFeatured]}>{subtitle}</Text>
      <Text style={[styles.comingSoon, featured && styles.comingSoonFeatured]}>Prochaine étape</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: palette.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },
  centeredMuted: { color: palette.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  loadingText: { color: palette.muted, fontSize: 15 },
  loginContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: palette.ink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  brandMarkText: { color: "#FFFFFF", fontSize: 19, fontWeight: "800", letterSpacing: -0.4 },
  loginTitle: { color: palette.ink, fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -1.1 },
  loginSubtitle: { color: palette.muted, fontSize: 17, marginTop: 6, marginBottom: 30 },
  formCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 22,
    padding: 20,
    gap: 10,
  },
  label: { color: palette.ink, fontSize: 13, fontWeight: "700", marginTop: 4 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 13,
    paddingHorizontal: 15,
    color: palette.ink,
    backgroundColor: "#FFFFFF",
    fontSize: 16,
    marginBottom: 6,
  },
  errorText: { color: palette.danger, fontSize: 13, marginBottom: 2 },
  errorTitle: { color: palette.ink, fontSize: 22, fontWeight: "800", textAlign: "center" },
  primaryButton: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: palette.surface,
  },
  secondaryButtonText: { color: palette.ink, fontWeight: "700" },
  buttonPressed: { opacity: 0.72 },
  screenContainer: { padding: 22, paddingBottom: 40 },
  eyebrow: { color: palette.accent, fontWeight: "800", fontSize: 11, letterSpacing: 1.1 },
  screenTitle: { color: palette.ink, fontSize: 30, fontWeight: "800", letterSpacing: -0.8, marginTop: 7 },
  screenSubtitle: { color: palette.muted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 24 },
  listGap: { gap: 12 },
  brandCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandCardTitle: { color: palette.ink, fontSize: 17, fontWeight: "800" },
  brandCardMeta: { color: palette.muted, fontSize: 13, marginTop: 4 },
  chevron: { color: palette.muted, fontSize: 30, lineHeight: 30 },
  emptyCard: {
    marginTop: 12,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  emptyTitle: { color: palette.ink, fontSize: 16, fontWeight: "800" },
  emptyText: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
  linkButton: { alignSelf: "center", marginTop: 26, padding: 10 },
  linkButtonText: { color: palette.muted, fontWeight: "700", fontSize: 14 },
  homeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 },
  homeTitle: { color: palette.ink, fontSize: 28, fontWeight: "800", letterSpacing: -0.8, marginTop: 5 },
  homeMeta: { color: palette.muted, fontSize: 13, marginTop: 3 },
  switchButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: palette.surface },
  switchButtonText: { color: palette.accent, fontWeight: "700", fontSize: 13 },
  heroCard: { backgroundColor: palette.ink, borderRadius: 24, padding: 22, marginBottom: 26 },
  heroKicker: { color: "#A5B4FC", fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  heroTitle: { color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontWeight: "800", letterSpacing: -0.5, marginTop: 10 },
  heroText: { color: "#D0D5DD", fontSize: 14, lineHeight: 21, marginTop: 9 },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: "800", marginBottom: 13 },
  actionGrid: { gap: 11 },
  actionCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    padding: 18,
    backgroundColor: palette.surface,
  },
  actionCardFeatured: { borderColor: "#C7D2FE", backgroundColor: palette.accentSoft },
  actionTitle: { color: palette.ink, fontSize: 17, fontWeight: "800" },
  actionTitleFeatured: { color: "#27346A" },
  actionSubtitle: { color: palette.muted, fontSize: 14, marginTop: 4 },
  actionSubtitleFeatured: { color: "#596591" },
  comingSoon: { color: palette.muted, fontSize: 11, fontWeight: "700", marginTop: 13, textTransform: "uppercase", letterSpacing: 0.5 },
  comingSoonFeatured: { color: palette.accent },
  securityCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: palette.successSoft,
    borderRadius: 16,
    padding: 16,
    marginTop: 22,
  },
  securityDot: { width: 9, height: 9, borderRadius: 99, backgroundColor: palette.success, marginTop: 5 },
  securityTitle: { color: palette.success, fontSize: 14, fontWeight: "800" },
  securityText: { color: "#344054", fontSize: 12, lineHeight: 18, marginTop: 3 },
});
