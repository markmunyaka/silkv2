import Anthropic from '@anthropic-ai/sdk';

export interface VideoScene {
  title: string;
  description: string;
  duration: string;
  visualCues: string[];
}

export interface VideoScript {
  hook: {
    text: string;
    duration: string;
  };
  scenes: VideoScene[];
  cta: {
    text: string;
    duration: string;
  };
  totalDuration: string;
  aesthetic: string;
}

const client = new Anthropic();

export async function generateVideoScript(summaryText: string): Promise<VideoScript> {
  try {
    if (!summaryText || summaryText.trim().length === 0) {
      throw new Error('Summary text cannot be empty');
    }

    const prompt = `You are a professional video script writer for AI-generated videos (HeyGen/Sora/Veo compatible). 

Convert this document summary into a 60-second video script with a modern, cinematic 8K aesthetic featuring glassmorphism UI overlays.

SUMMARY TO CONVERT:
${summaryText}

REQUIRED OUTPUT FORMAT (respond only with valid JSON):
{
  "hook": {
    "text": "A startling fact or compelling statement from the document (8-10 seconds, 20-30 words)",
    "duration": "8-10 seconds"
  },
  "scenes": [
    {
      "title": "Scene 1 Title",
      "description": "Detailed visual description for AI video generator. Include background, camera movement, lighting, and elements. Make it cinematic and vivid.",
      "duration": "15-18 seconds",
      "visualCues": ["Element 1", "Element 2", "UI Element", "Color palette hint"]
    },
    {
      "title": "Scene 2 Title", 
      "description": "Second key visual scene with distinct aesthetic. Include data visualization or infographic elements.",
      "duration": "15-18 seconds",
      "visualCues": ["Element 1", "Element 2", "Animation type"]
    },
    {
      "title": "Scene 3 Title",
      "description": "Third visual scene showing impact or next steps. Include cinematic transitions.",
      "duration": "15-18 seconds",
      "visualCues": ["Element 1", "Element 2", "Transition effect"]
    }
  ],
  "cta": {
    "text": "Closing statement inviting users to download the full report or take action (8-10 seconds, 15-25 words)",
    "duration": "8-10 seconds"
  },
  "totalDuration": "60 seconds",
  "aesthetic": "Modern, cinematic, 8K quality. Glassmorphism UI elements with subtle animations. Cool color palette with accent highlights. Minimalist design with dynamic data visualizations."
}

Requirements:
- Hook: Startling fact or key insight that grabs attention
- Each scene: Highly detailed visual descriptions suitable for AI video generation
- Include specific visual elements, camera movements, and lighting directions
- CTA: Clear call-to-action that converts viewers
- Aesthetic: Describe the overall visual style with glassmorphism and modern UI elements
- Total must be approximately 60 seconds
- All text must be concise and impactful
- Visual cues must be specific and actionable for AI video generators`;

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse video script from response');
    }

    const videoScript: VideoScript = JSON.parse(jsonMatch[0]);

    // Validate the structure
    if (!videoScript.hook || !videoScript.scenes || videoScript.scenes.length !== 3 || !videoScript.cta) {
      throw new Error('Invalid video script structure received from API');
    }

    return videoScript;
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse video script: ${error.message}`);
    }
    throw new Error(`Failed to generate video script: ${error.message}`);
  }
}
