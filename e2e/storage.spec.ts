import { expect, test } from "@playwright/test";
import { adminClient, userClient } from "./test-helpers";

const brandId = "00000000-0000-0000-0000-000000000101";
const otherBrandId = "00000000-0000-0000-0000-000000000102";
const animatorId = "00000000-0000-0000-0000-0000000000a5";

test("matrice complète Storage privée Sprint 5", async () => {
  const admin = adminClient();
  const animator = await userClient("animatrice@dermavita.local");
  const otherAnimator = await userClient("autre-animatrice@dermavita.local");
  const brandAdmin = await userClient("admin@dermavita.local");
  const otherBrandAdmin = await userClient("admin@nutrilab.local");
  const tr1 = await userClient("superadmin@tr1.local");
  const missionId = crypto.randomUUID();
  const objectPath = `${brandId}/${missionId}/${crypto.randomUUID()}.png`;
  const forbiddenPath = `${brandId}/${missionId}/${crypto.randomUUID()}.txt`;
  const oversizedPath = `${brandId}/${missionId}/${crypto.randomUUID()}.png`;

  const { error: missionError } = await admin.from("missions").insert({
    id: missionId,
    organization_id: "00000000-0000-0000-0000-000000000002",
    brand_id: brandId,
    brand_pharmacy_id: "00000000-0000-0000-0000-000000000411",
    pharmacy_id: "00000000-0000-0000-0000-000000000401",
    assigned_user_id: animatorId,
    managed_by: "00000000-0000-0000-0000-0000000000a1",
    created_by: "00000000-0000-0000-0000-0000000000a1",
    mission_type: "animation",
    status: "assigned",
    title: "Mission Storage E2E",
    objective: "Valider les politiques Storage",
  });
  expect(missionError).toBeNull();

  await test.step("upload image autorisée et chemin multi-tenant", async () => {
    const upload = await animator.storage.from("mission-evidence").upload(objectPath, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), { contentType: "image/png" });
    expect(upload.error).toBeNull();
    const { error } = await animator.from("mission_attachments").insert({ mission_id: missionId, brand_id: brandId, object_path: objectPath, original_name: "preuve.png", mime_type: "image/png", size_bytes: 8, visibility: "provider_private", uploaded_by: animatorId });
    expect(error).toBeNull();
    const { data } = await admin.from("mission_attachments").select("object_path").eq("mission_id", missionId).single();
    expect(data?.object_path).toMatch(new RegExp(`^${brandId}/${missionId}/[^/]+\\.png$`));
  });

  await test.step("type MIME interdit", async () => {
    const result = await animator.storage.from("mission-evidence").upload(forbiddenPath, new TextEncoder().encode("script"), { contentType: "text/plain" });
    expect(result.error).not.toBeNull();
  });

  await test.step("fichier supérieur à 10 Mo", async () => {
    const result = await animator.storage.from("mission-evidence").upload(oversizedPath, new Uint8Array(10_485_761), { contentType: "image/png" });
    expect(result.error).not.toBeNull();
  });

  await test.step("autre marque et autre animateur interdits", async () => {
    expect((await otherBrandAdmin.storage.from("mission-evidence").createSignedUrl(objectPath, 60)).error).not.toBeNull();
    expect((await otherAnimator.storage.from("mission-evidence").createSignedUrl(objectPath, 60)).error).not.toBeNull();
  });

  await test.step("responsable TR1 autorisé même en visibilité privée", async () => {
    expect((await tr1.storage.from("mission-evidence").createSignedUrl(objectPath, 60)).error).toBeNull();
  });

  await test.step("marque autorisée uniquement si shared", async () => {
    expect((await brandAdmin.storage.from("mission-evidence").createSignedUrl(objectPath, 60)).error).not.toBeNull();
    expect((await admin.from("mission_attachments").update({ visibility: "shared" }).eq("object_path", objectPath)).error).toBeNull();
    expect((await brandAdmin.storage.from("mission-evidence").createSignedUrl(objectPath, 60)).error).toBeNull();
  });

  await test.step("URL signée valide puis expirée", async () => {
    const signed = await animator.storage.from("mission-evidence").createSignedUrl(objectPath, 1);
    expect(signed.error).toBeNull();
    expect((await fetch(signed.data!.signedUrl)).ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 2_100));
    expect((await fetch(signed.data!.signedUrl)).ok).toBe(false);
  });

  await test.step("remplacement de chemin inter-tenant impossible", async () => {
    const replacedPath = `${otherBrandId}/${missionId}/${objectPath.split("/").at(-1)}`;
    expect((await animator.storage.from("mission-evidence").createSignedUrl(replacedPath, 60)).error).not.toBeNull();
    const upload = await animator.storage.from("mission-evidence").upload(replacedPath, new Uint8Array([1]), { contentType: "image/png" });
    expect(upload.error).not.toBeNull();
  });

  await test.step("archivage contrôlé sans bucket public", async () => {
    const { data: attachment } = await admin.from("mission_attachments").select("id").eq("object_path", objectPath).single();
    expect((await animator.rpc("archive_mission_attachment", { target_attachment_id: attachment!.id })).error).toBeNull();
    const { data: archived } = await admin.from("mission_attachments").select("archived_at").eq("id", attachment!.id).single();
    expect(archived?.archived_at).toBeTruthy();
    expect((await animator.storage.from("mission-evidence").createSignedUrl(objectPath, 60)).error).not.toBeNull();
    const { data: bucket } = await admin.storage.getBucket("mission-evidence");
    expect(bucket?.public).toBe(false);
  });

  await admin.storage.from("mission-evidence").remove([objectPath]);
  await admin.from("missions").delete().eq("id", missionId);
});
