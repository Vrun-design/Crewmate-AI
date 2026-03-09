import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, test, vi} from 'vitest';
import {CreativeStudio} from './CreativeStudio';

const generateArtifactMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../hooks/useCreativeStudio', () => ({
  useCreativeStudio: () => ({
    artifact: null,
    isGenerating: false,
    error: null,
    generateArtifact: generateArtifactMock,
  }),
}));

describe('CreativeStudio', () => {
  test('submits a mixed-media creative generation request', async () => {
    render(<CreativeStudio />);

    fireEvent.click(screen.getByRole('button', {name: /generate creative artifact/i}));

    await waitFor(() => {
      expect(generateArtifactMock).toHaveBeenCalledTimes(1);
    });
  });
});
