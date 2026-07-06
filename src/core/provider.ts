/**
 * Core provider interfaces for media-gen-cli.
 * All provider adapters implement these contracts.
 */

export type ProviderCapability =
  | 'image-generate'
  | 'image-edit'
  | 'video-generate'
  | 'video-image-to-video'
  | 'video-extend'
  | 'voice-tts'
  | 'voice-clone'
  | 'voice-isolate'
  | 'audio-transcribe'
  | 'audio-translate';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MediaResult {
  outputFile: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface AsyncMediaResult {
  jobId: string;
  provider: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  statusUrl?: string;
  result?: MediaResult;
  error?: string;
}

export interface TextResult {
  text: string;
  outputFile?: string;
  segments?: TranscriptSegment[];
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface JobStatusResult {
  jobId: string;
  provider: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: MediaResult;
  error?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VoiceCloneResult {
  voiceId: string;
  name: string;
  provider: string;
  metadata?: Record<string, unknown>;
}

// --- Input types ---

export interface ImageGenerationInput {
  prompt: string;
  model: string;
  size?: string;
  quality?: string;
  style?: string;
  n?: number;
  outputFile: string;
  negativePrompt?: string;
}

export interface ImageEditInput {
  image: string;
  prompt: string;
  model: string;
  mask?: string;
  size?: string;
  outputFile: string;
}

export interface VideoGenerationInput {
  prompt: string;
  model: string;
  duration?: number;
  aspectRatio?: string;
  resolution?: string;
  outputFile: string;
  fps?: number;
}

export interface ImageToVideoInput {
  image: string;
  prompt?: string;
  model: string;
  duration?: number;
  aspectRatio?: string;
  outputFile: string;
}

export interface VideoExtendInput {
  video: string;
  prompt?: string;
  model: string;
  duration?: number;
  outputFile: string;
}

export interface TextToSpeechInput {
  text: string;
  voiceId: string;
  model?: string;
  speed?: number;
  outputFile: string;
  format?: string;
}

export interface VoiceCloneInput {
  name: string;
  files: string[];
  description?: string;
}

export interface TranscriptionInput {
  inputFile: string;
  model?: string;
  language?: string;
  outputFile: string;
}

export interface TranslationInput {
  inputFile: string;
  model?: string;
  targetLanguage?: string;
  outputFile: string;
}

export interface AudioIsolationInput {
  inputFile: string;
  outputFile: string;
}

// --- Provider interfaces ---

export interface MediaProvider {
  id: string;
  name: string;
  capabilities: ProviderCapability[];
  validateConfig(): Promise<ValidationResult>;
}

export interface ImageProvider {
  generateImage(input: ImageGenerationInput): Promise<MediaResult>;
  editImage?(input: ImageEditInput): Promise<MediaResult>;
}

export interface VideoProvider {
  generateVideo(input: VideoGenerationInput): Promise<AsyncMediaResult | MediaResult>;
  imageToVideo?(input: ImageToVideoInput): Promise<AsyncMediaResult | MediaResult>;
  extendVideo?(input: VideoExtendInput): Promise<AsyncMediaResult | MediaResult>;
  getJobStatus?(jobId: string): Promise<JobStatusResult>;
  downloadJob?(jobId: string, outputFile: string): Promise<MediaResult>;
}

export interface VoiceProvider {
  textToSpeech(input: TextToSpeechInput): Promise<MediaResult>;
  cloneVoice?(input: VoiceCloneInput): Promise<VoiceCloneResult>;
}

export interface AudioProvider {
  transcribe(input: TranscriptionInput): Promise<TextResult>;
  translate?(input: TranslationInput): Promise<TextResult>;
  isolateVoice?(input: AudioIsolationInput): Promise<MediaResult>;
}

// Combined provider type
export type FullProvider = MediaProvider &
  Partial<ImageProvider & VideoProvider & VoiceProvider & AudioProvider>;
