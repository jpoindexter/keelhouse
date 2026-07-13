import type { ComposerAttachment, ComposerHarnessState } from "./composerHarness";

export type ChatContextFile = { path: string; content: string; bytes: number };
export type ChatContextImage = { path: string; bytes: number; mimeType: string };

export type PreparedChatContext = {
  prompt: string;
  images: string[];
  preview: string;
};

type ContextReaders = {
  readFile: (attachment: ComposerAttachment) => Promise<ChatContextFile>;
  inspectImage: (attachment: ComposerAttachment) => Promise<ChatContextImage>;
};

export async function prepareChatContext(
  draft: string,
  state: ComposerHarnessState,
  readers: ContextReaders,
): Promise<PreparedChatContext> {
  const sections: string[] = [];
  const images: string[] = [];
  if (state.goal) sections.push(`Goal:\n${state.goal}`);
  for (const attachment of state.attachments) {
    if (attachment.kind === "file") {
      const file = await readers.readFile(attachment);
      sections.push(`File: ${attachment.label} (${file.path}, ${file.bytes} bytes)\n\n${file.content}`);
    } else if (attachment.kind === "image") {
      const image = await readers.inspectImage(attachment);
      images.push(image.path);
      sections.push(`Image: ${attachment.label} (${image.mimeType}, ${image.bytes} bytes, ${image.path})`);
    } else {
      sections.push(`Reference: ${attachment.label} (${attachment.target})`);
    }
  }
  const prompt = sections.length > 0 ? `${sections.join("\n\n---\n\n")}\n\n---\n\n${draft}` : draft;
  return { prompt, images, preview: prompt };
}
