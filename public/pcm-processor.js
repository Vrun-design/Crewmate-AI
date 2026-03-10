/**
 * AudioWorklet processor for real-time PCM capture.
 * Replaces the deprecated ScriptProcessorNode.
 * Runs in the audio rendering thread and posts Float32Array chunks
 * back to the main thread via MessagePort.
 */
class PcmCaptureProcessor extends AudioWorkletProcessor {
    process(inputs) {
        const input = inputs[0];
        if (input && input[0] && input[0].length > 0) {
            // Post a copy so the buffer doesn't get overwritten before the main thread reads it
            this.port.postMessage(input[0].slice(0));
        }
        return true; // keep the processor alive
    }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
