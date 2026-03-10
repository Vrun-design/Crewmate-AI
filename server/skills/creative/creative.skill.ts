/**
 * Creative Skill — generates images via Gemini Flash Image model.
 * Used by Marketing and Social agents for campaign visuals, mockups, social media images.
 */
import type { Skill } from '../types';
import { generateCreativeArtifact } from '../../services/creativeStudioService';

export const creativeGenerateImageSkill: Skill = {
    id: 'creative.generate-image',
    name: 'Generate Image',
    description: 'Generate a creative image using the Gemini image model. Use when the user asks to create, design, or generate a visual — logos, social media images, mockups, illustrations.',
    version: '1.0.0',
    category: 'productivity',
    personas: ['marketer', 'designer', 'founder'],
    requiresIntegration: [],
    triggerPhrases: [
        'Generate an image of',
        'Create a visual for',
        'Design a graphic',
        'Make an illustration',
        'Create a social media image',
        'Generate a banner',
    ],
    preferredModel: 'creative',
    inputSchema: {
        type: 'object',
        properties: {
            prompt: { type: 'string', description: 'Description of the image to generate — be specific about style, colors, content, and mood' },
            context: { type: 'string', description: 'Optional additional context (e.g. brand colors, target audience, use case)' },
            outputStyle: { type: 'string', description: 'Optional style guide (e.g. "minimalist product photo", "vibrant social banner", "technical diagram")' },
        },
        required: ['prompt'],
    },
    handler: async (ctx, args) => {
        const prompt = String(args.prompt ?? '');
        const context = args.context ? String(args.context) : undefined;
        const outputStyle = args.outputStyle ? String(args.outputStyle) : undefined;

        const artifact = await generateCreativeArtifact(ctx.userId, {
            prompt,
            context,
            outputStyle,
        });

        return {
            success: true,
            output: {
                title: artifact.title,
                narrative: artifact.narrative,
                hasImage: Boolean(artifact.imageData),
                imageMimeType: artifact.imageMimeType,
            },
            message: artifact.imageData
                ? `✅ Image generated for: "${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}"`
                : `✅ Creative concept generated (no image data returned): "${prompt.slice(0, 60)}…"`,
        };
    },
};
