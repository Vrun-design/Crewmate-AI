import React, {useState} from 'react';
import {Card, CardContent} from '../components/ui/Card';
import {Button} from '../components/ui/Button';
import {PageHeader} from '../components/ui/PageHeader';
import {useCreativeStudio} from '../hooks/useCreativeStudio';

export function CreativeStudio() {
  const [prompt, setPrompt] = useState('Create a launch storyboard for a screen-aware AI product operator helping a PM catch a checkout bug.');
  const [context, setContext] = useState('Use a cinematic product-demo tone. Show one laptop screen, one floating live agent overlay, and one team handoff moment.');
  const [outputStyle, setOutputStyle] = useState('High-contrast launch storyboard');
  const {artifact, isGenerating, error, generateArtifact} = useCreativeStudio();

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Creative Studio"
        description="Generate a mixed-media concept with narrative copy and an accompanying image in one flow."
      />

      <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Prompt</label>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Context</label>
              <textarea
                value={context}
                onChange={(event) => setContext(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Style</label>
              <input
                value={outputStyle}
                onChange={(event) => setOutputStyle(event.target.value)}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring"
              />
            </div>
            <Button
              variant="primary"
              className="w-full"
              disabled={isGenerating || !prompt.trim()}
              onClick={() => void generateArtifact({prompt, context, outputStyle})}
            >
              {isGenerating ? 'Generating mixed output...' : 'Generate Creative Artifact'}
            </Button>
            {error ? <div className="text-sm text-amber-500">{error}</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-5">
            {artifact?.imageData ? (
              <img
                src={`data:${artifact.imageMimeType ?? 'image/png'};base64,${artifact.imageData}`}
                alt={artifact.title}
                className="w-full rounded-2xl border border-border object-cover"
              />
            ) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/30 text-sm text-muted-foreground">
                Generated image will appear here.
              </div>
            )}

            <div className="rounded-2xl border border-border bg-secondary/30 p-5">
              <div className="text-sm font-medium text-foreground">Narrative Output</div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {artifact?.narrative || 'Generated copy will appear here after the image + text response completes.'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
