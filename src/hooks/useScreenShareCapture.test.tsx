import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import {useScreenShareCapture} from './useScreenShareCapture';

const {sendFrameMock, getDisplayMediaMock} = vi.hoisted(() => ({
  sendFrameMock: vi.fn(),
  getDisplayMediaMock: vi.fn(),
}));

vi.mock('../services/liveSessionService', () => ({
  liveSessionService: {
    sendFrame: sendFrameMock,
  },
}));

describe('useScreenShareCapture', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    window.btoa = vi.fn(() => 'encoded-frame');
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => {
      callback(new Blob(['frame'], {type: 'image/jpeg'}));
    });

    const track = {
      stop: vi.fn(),
      onended: null,
    };

    getDisplayMediaMock.mockResolvedValue({
      getTracks: () => [track],
      getVideoTracks: () => [track],
    });

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);

      if (tagName === 'video') {
        Object.defineProperty(element, 'videoWidth', {
          value: 1280,
          configurable: true,
        });
        Object.defineProperty(element, 'videoHeight', {
          value: 720,
          configurable: true,
        });
      }

      return element;
    });

    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: {
        getDisplayMedia: getDisplayMediaMock,
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('captures and uploads a frame when started explicitly', async () => {
    sendFrameMock.mockResolvedValue({ok: true});

    const {result} = renderHook(() =>
      useScreenShareCapture({
        sessionId: 'SES-200',
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startScreenShare();
    });

    await waitFor(() => {
      expect(sendFrameMock).toHaveBeenCalledTimes(1);
    });

    expect(getDisplayMediaMock).toHaveBeenCalledTimes(1);
    expect(result.current.previewStream).not.toBeNull();
    expect(sendFrameMock).toHaveBeenCalledWith(
      'SES-200',
      expect.objectContaining({
        mimeType: 'image/jpeg',
        data: 'encoded-frame',
      }),
    );
  });

  test('stops the stream when disabled', async () => {
    sendFrameMock.mockResolvedValue({ok: true});

    const track = {
      stop: vi.fn(),
      onended: null,
    };

    getDisplayMediaMock.mockResolvedValue({
      getTracks: () => [track],
      getVideoTracks: () => [track],
    });

    const {result, rerender} = renderHook(
      ({enabled}) =>
        useScreenShareCapture({
          sessionId: 'SES-201',
          enabled,
        }),
      {
        initialProps: {enabled: true},
      },
    );

    await act(async () => {
      await result.current.startScreenShare();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('sharing');
    });

    rerender({enabled: false});
    await act(async () => {});

    expect(track.stop).toHaveBeenCalled();
    expect(result.current.previewStream).toBeNull();
    expect(result.current.status).toBe('idle');
  });
});
