import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export function GuidedReportField({ label, value, options, onChange, disabled = false }: {
  label: string; value: string; options: readonly string[]; onChange: (value: string) => void; disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const custom = Boolean(value && !options.includes(value));
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {!disabled ? <View style={styles.choices}>{options.map((option) => <Pressable
      key={option} accessibilityRole="radio" accessibilityLabel={`${label} : ${option}`}
      accessibilityState={{ selected: value === option }}
      onPress={() => { onChange(value === option ? "" : option); setEditing(false); }}
      style={[styles.choice, value === option && styles.selected]}>
      <Text style={[styles.choiceText, value === option && styles.selectedText]}>{value === option ? "✓ " : ""}{option}</Text>
    </Pressable>)}</View> : null}
    {disabled ? <Text style={styles.readOnly}>{value || "Non renseigné"}</Text> : <>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: editing || custom }} onPress={() => setEditing(!editing)} style={styles.edit}>
        <Text style={styles.editText}>{editing || custom ? "Texte personnalisable ci-dessous" : value ? "Préciser cette réponse" : "Autre réponse / préciser"}</Text>
      </Pressable>
      {editing || custom ? <TextInput accessibilityLabel={label} multiline value={value} onChangeText={onChange} placeholder="Ajoutez uniquement les précisions utiles" style={styles.input} /> : null}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  field: { marginTop: 18 }, label: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 10 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: 48, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: "#FFF", justifyContent: "center" },
  selected: { backgroundColor: "#EEF2FF", borderColor: "#3B5BDB" }, choiceText: { fontSize: 15, color: "#344054" }, selectedText: { color: "#263EA8", fontWeight: "700" },
  edit: { minHeight: 48, justifyContent: "center" }, editText: { color: "#3448A5", fontSize: 14 },
  input: { minHeight: 90, padding: 12, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, color: "#111827", textAlignVertical: "top", fontSize: 16 }, readOnly: { color: "#344054", fontSize: 16 },
});
