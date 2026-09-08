import { PermissionsAndroid, Platform } from "react-native";

export const MAX_ORDER_SCAN_PAGES = 6;

async function ensureAndroidCameraPermission() {
  if (Platform.OS !== "android") return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: "Scanner une commande",
    message: "TR1 Pharma a besoin de la caméra pour scanner le bon de commande.",
    buttonPositive: "Autoriser",
    buttonNegative: "Annuler",
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function scanOrderDocumentPages(): Promise<string[]> {
  if (Platform.OS === "web") {
    throw new Error("Le scanner de documents est disponible uniquement dans l’application TR1 Pharma installée.");
  }

  if (!(await ensureAndroidCameraPermission())) {
    throw new Error("Autorisez l’accès à la caméra pour scanner la commande.");
  }

  try {
    const module = await import("react-native-document-scanner-plugin");
    const scanner = module.default;
    const result = await scanner.scanDocument({
      croppedImageQuality: 85,
      maxNumDocuments: MAX_ORDER_SCAN_PAGES,
    });

    if (result.status === "cancel") return [];
    const scannedImages = result.scannedImages ?? [];
    return scannedImages.filter(Boolean).slice(0, MAX_ORDER_SCAN_PAGES);
  } catch (error) {
    if (error instanceof Error && /camera|permission|autor/i.test(error.message)) throw error;
    throw new Error("Le scanner natif n’est pas disponible dans cette version de l’application. Un nouveau build TR1 est requis.");
  }
}
