import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

export async function saveAndSharePdf(
  content: ArrayBuffer,
  filePrefix = "tickets",
): Promise<{ uri: string; shared: boolean }> {
  const fileName = `${filePrefix}-${Date.now()}.pdf`;
  const output = new File(Paths.cache, fileName);
  output.create({ overwrite: true, intermediates: true });
  output.write(new Uint8Array(content));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(output.uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
    });
    return { uri: output.uri, shared: true };
  }

  return { uri: output.uri, shared: false };
}
