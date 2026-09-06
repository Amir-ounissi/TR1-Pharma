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

import { FieldWorkspace } from "./src/screens/field-workspace";
import { supabase } from "./src/lib/supabase";

export type BrandContext = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type BrandContextRow = {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  role_key: string;
};

const ACTIVE_BRAND_STORAGE_KEY = "tr1_mobile_active_brand";

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
        setActiveBrandId(
          savedIsValid && savedBrandId
            ? savedBrandId
            : availableContexts.length === 1
              ? availableContexts[0]?.id ?? null
              : null,
        );
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
  }, [session]);

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

  if (booting || (session && contextsPending)) return <LoadingScreen label="Ouverture de TR1 Pharma" />;
  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.loginContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>TR1</Text></View>
            <Text style={styles.loginTitle}>TR1 Pharma</Text>
            <Text style={styles.loginSubtitle}>Le terrain, dans votre poche.</Text>
            <View style={styles.formCard}>
              <Text style={styles.label}>Email professionnel</Text>
              <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="vous@marque.fr" placeholderTextColor="#98A2B3" style={styles.input} />
              <Text style={styles.label}>Mot de passe</Text>
              <TextInput autoCapitalize="none" autoComplete="password" secureTextEntry value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor="#98A2B3" style={styles.input} />
              {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
              <Pressable disabled={authPending || !email.trim() || !password} onPress={signIn} style={[styles.primaryButton, (authPending || !email.trim() || !password) && styles.disabled]}>
                {authPending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Se connecter</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (contextError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}><Text style={styles.errorTitle}>Connexion TR1 incomplète</Text><Text style={styles.muted}>{contextError}</Text><Pressable onPress={signOut} style={styles.secondaryButton}><Text>Se déconnecter</Text></Pressable></View>
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
          <Text style={styles.muted}>TR1 n’affichera que les données auxquelles votre compte a accès.</Text>
          <View style={styles.brandList}>
            {contexts.map((context) => (
              <Pressable key={context.id} onPress={() => chooseBrand(context.id)} style={styles.brandCard}>
                <View><Text style={styles.brandCardTitle}>{context.name}</Text><Text style={styles.mutedSmall}>{context.role}</Text></View><Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={signOut} style={styles.linkButton}><Text style={styles.linkButtonText}>Se déconnecter</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <FieldWorkspace
      brand={activeBrand}
      canSwitchBrand={contexts.length > 1}
      onSwitchBrand={() => setActiveBrandId(null)}
      onSignOut={signOut}
    />
  );
}

function LoadingScreen({ label }: { label: string }) {
  return <SafeAreaView style={styles.safeArea}><StatusBar style="dark" /><View style={styles.centered}><ActivityIndicator size="large" color="#3B5BDB" /><Text style={styles.muted}>{label}</Text></View></SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: "#F7F8FA" }, centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 },
  loginContainer: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 36 }, brandMark: { width: 54, height: 54, borderRadius: 17, backgroundColor: "#111827", alignItems: "center", justifyContent: "center", marginBottom: 20 }, brandMarkText: { color: "#FFF", fontSize: 19, fontWeight: "800" },
  loginTitle: { color: "#111827", fontSize: 34, fontWeight: "800" }, loginSubtitle: { color: "#667085", fontSize: 17, marginTop: 6, marginBottom: 30 }, formCard: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 22, padding: 20, gap: 10 }, label: { color: "#111827", fontSize: 13, fontWeight: "700", marginTop: 4 }, input: { minHeight: 52, borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 13, paddingHorizontal: 15, color: "#111827", backgroundColor: "#FFF", fontSize: 16, marginBottom: 6 },
  primaryButton: { minHeight: 54, borderRadius: 14, backgroundColor: "#3B5BDB", alignItems: "center", justifyContent: "center", marginTop: 8 }, primaryButtonText: { color: "#FFF", fontWeight: "800", fontSize: 16 }, disabled: { opacity: 0.45 }, errorText: { color: "#B42318", fontSize: 13 }, errorTitle: { color: "#111827", fontSize: 22, fontWeight: "800", textAlign: "center" }, muted: { color: "#667085", fontSize: 15, lineHeight: 22, textAlign: "center" }, mutedSmall: { color: "#667085", fontSize: 13, marginTop: 4 }, secondaryButton: { borderWidth: 1, borderColor: "#E4E7EC", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: "#FFF" },
  screenContainer: { padding: 22, paddingBottom: 40 }, eyebrow: { color: "#3B5BDB", fontWeight: "800", fontSize: 11, letterSpacing: 1.1 }, screenTitle: { color: "#111827", fontSize: 30, fontWeight: "800", marginTop: 7, marginBottom: 8 }, brandList: { gap: 12, marginTop: 24 }, brandCard: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4E7EC", borderRadius: 18, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, brandCardTitle: { color: "#111827", fontSize: 17, fontWeight: "800" }, chevron: { color: "#667085", fontSize: 30 }, linkButton: { alignSelf: "center", marginTop: 26, padding: 10 }, linkButtonText: { color: "#667085", fontWeight: "700" },
});