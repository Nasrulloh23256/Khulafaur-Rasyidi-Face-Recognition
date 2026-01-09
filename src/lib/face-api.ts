let modelsLoaded = false;
let ssdLoaded = false;
let faceLandmarkFullLoaded = false;
let faceapi: typeof import("face-api.js") | null = null;

const MODEL_URL = "/models";

const loadFaceApi = async () => {
  if (!faceapi) {
    faceapi = await import("face-api.js");
  }
  return faceapi;
};

const loadOptionalModel = async (loadFn: () => Promise<void>, onSuccess: () => void) => {
  try {
    await loadFn();
    onSuccess();
  } catch {
    // Optional model, ignore load failures.
  }
};

export const loadFaceModels = async () => {
  if (modelsLoaded || typeof window === "undefined") return;
  const api = await loadFaceApi();

  await Promise.all([
    api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    api.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    loadOptionalModel(() => api.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), () => {
      ssdLoaded = true;
    }),
    loadOptionalModel(() => api.nets.faceLandmark68Net.loadFromUri(MODEL_URL), () => {
      faceLandmarkFullLoaded = true;
    }),
  ]);

  modelsLoaded = true;
};

const getDetectorOptions = (api: typeof import("face-api.js")) => {
  if (ssdLoaded) {
    return new api.SsdMobilenetv1Options({ minConfidence: 0.6 });
  }
  return new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
};

export const detectFaceWithDescriptor = async (
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
) => {
  const api = await loadFaceApi();
  await loadFaceModels();

  const detectorOptions = getDetectorOptions(api);
  const withDescriptor = await (faceLandmarkFullLoaded
    ? api.detectSingleFace(input, detectorOptions).withFaceLandmarks()
    : api.detectSingleFace(input, detectorOptions).withFaceLandmarks(true)
  ).withFaceDescriptor();
  if (!withDescriptor) return null;

  return {
    detection: withDescriptor.detection,
    landmarks: withDescriptor.landmarks,
    descriptor: withDescriptor.descriptor,
  };
};

export const getFaceDescriptor = async (
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
) => {
  if (typeof window === "undefined") return null;
  const result = await detectFaceWithDescriptor(input);
  return result?.descriptor ?? null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getStableFaceDescriptor = async (
  input: HTMLVideoElement,
  options?: { samples?: number; minSamples?: number; intervalMs?: number },
) => {
  if (typeof window === "undefined") return null;

  const samples = options?.samples ?? 6;
  const minSamples = options?.minSamples ?? 3;
  const intervalMs = options?.intervalMs ?? 150;

  const descriptors: Float32Array[] = [];

  for (let i = 0; i < samples; i += 1) {
    const descriptor = await getFaceDescriptor(input);
    if (descriptor) {
      descriptors.push(descriptor);
    }
    if (i < samples - 1) {
      await sleep(intervalMs);
    }
  }

  if (descriptors.length < minSamples) {
    return null;
  }

  const length = descriptors[0].length;
  const averaged = new Float32Array(length);

  for (const descriptor of descriptors) {
    for (let i = 0; i < length; i += 1) {
      averaged[i] += descriptor[i];
    }
  }

  for (let i = 0; i < length; i += 1) {
    averaged[i] /= descriptors.length;
  }

  return averaged;
};
