# Video Script & Scene Generator Setup Guide

## Overview
This feature converts document summaries into cinematic 60-second video scripts optimized for AI video generators (HeyGen, Sora, Veo).

## Installation Steps

### 1. Core Service (Already Created ✅)
The video script generation service is ready at:
- `src/utils/videoScriptGenerator.ts` - Contains `generateVideoScript()` function that uses Claude API

### 2. UI Components (Already Created ✅)
The preview component is ready at:
- `src/components/VideoScriptPreview.tsx` - Renders the generated video script

### 3. Setup API Endpoint

Create the directory and file:
```bash
mkdir -p src/app/api/generate-video-script
```

Copy the content from `INSTALL_VIDEO_SCRIPT_API.ts` to:
```
src/app/api/generate-video-script/route.ts
```

### 4. Setup Page Route

Create the directory and file:
```bash
mkdir -p src/app/video-script
```

Copy the content from `INSTALL_VIDEO_SCRIPT.ts` to:
```
src/app/video-script/page.tsx
```

### 5. Update Navigation

Add a link to the new Video Script Generator in `src/components/Navigation.tsx`:

```jsx
<Link href="/video-script" className="...">
  🎬 Video Scripts
</Link>
```

## Features

### Input
- Paste any document summary (up to 5,000 characters)
- Real-time character count display

### Output Structure
The generated video script includes:

1. **Hook (8-10 seconds)**
   - Startling fact or compelling statement
   - Designed to grab viewer attention

2. **Three Visual Scenes (15-18 seconds each)**
   - Scene 1: Key concept with background description
   - Scene 2: Data/visualization with cinematic elements
   - Scene 3: Impact/next steps with transitions
   - Each includes visual cues for AI video generators

3. **Call-to-Action (8-10 seconds)**
   - Closing statement
   - Invites user action (download, sign up, etc.)

4. **Visual Aesthetic**
   - Modern, cinematic, 8K quality
   - Glassmorphism UI elements
   - Cool color palette with accent highlights
   - Minimalist design with dynamic visualizations

### Export Options
- **JSON Format**: Complete script structure for programmatic use
- **Text Format**: Human-readable script for directors/creators

## API Endpoint

**POST** `/api/generate-video-script`

Request:
```json
{
  "summary": "Your document summary text here..."
}
```

Response:
```json
{
  "hook": {
    "text": "...",
    "duration": "8-10 seconds"
  },
  "scenes": [
    {
      "title": "Scene Title",
      "description": "Detailed visual description...",
      "duration": "15-18 seconds",
      "visualCues": ["cue1", "cue2", "cue3"]
    },
    ...
  ],
  "cta": {
    "text": "...",
    "duration": "8-10 seconds"
  },
  "totalDuration": "60 seconds",
  "aesthetic": "Modern, cinematic, 8K quality..."
}
```

## Dependencies

The feature uses:
- **@anthropic-ai/sdk** - For Claude API integration (already installed)
- **React** - For UI components (already installed)
- **Next.js** - For routing (already installed)

## Environment Setup

Ensure your `.env.local` has:
```
ANTHROPIC_API_KEY=your-key-here
```

The service uses the existing Anthropic API key configured in your application.

## Usage Flow

1. Navigate to `/video-script` page
2. Paste a document summary
3. Click "Generate Video Script"
4. Preview the structured script with Hook, Scenes, and CTA
5. Download as JSON (for AI video generators) or Text (for creators)
6. Use the script to generate video using HeyGen, Sora, or Veo

## Script Structure Details

### Hook
- **Purpose**: Grab attention with startling fact
- **Duration**: 8-10 seconds
- **Content**: 20-30 words maximum
- **Tone**: Compelling, intriguing

### Scenes
- **Scene 1**: Introduces key concept with visual setting
  - Background description with cinematic details
  - 15-18 seconds duration
  
- **Scene 2**: Presents data/insights with visualizations
  - Includes infographic or data elements
  - 15-18 seconds duration
  
- **Scene 3**: Shows impact and next steps
  - Includes cinematic transitions
  - 15-18 seconds duration

### Visual Cues
Each scene includes specific visual elements:
- UI elements (cards, glassmorphism overlays, etc.)
- Camera movements (pan, zoom, dolly, etc.)
- Lighting directions
- Color palette hints
- Animation effects

### CTA (Call-to-Action)
- **Purpose**: Drive user action
- **Duration**: 8-10 seconds
- **Content**: 15-25 words maximum
- **Tone**: Clear, actionable, persuasive

## Aesthetic Guidelines

The generated scripts follow these visual guidelines:

```
Style: Modern, cinematic, 8K quality
Background: Minimalist with dynamic elements
UI Elements: Glassmorphism with transparency
Colors: Cool palette with warm accent highlights
Animations: Subtle, smooth transitions
Typography: Sans-serif, clean hierarchy
Overlays: Semi-transparent gradient overlays
Effects: Particle effects, smooth scrolling
```

## Integration with Existing Features

The Video Script Generator is designed to work alongside:
- **PDF Summarization**: Use generated summaries as input
- **Document Library**: Reference previously summarized documents
- **Dashboard**: Quick access from main navigation

## Troubleshooting

### "Failed to generate video script"
- Check API key in `.env.local`
- Ensure summary text is provided (max 5000 characters)
- Verify Claude API is accessible

### "Invalid request or missing API credentials"
- Verify `ANTHROPIC_API_KEY` is set correctly
- Check API key has proper permissions

### Script quality issues
- Use longer, more detailed summaries for better results
- Include key metrics and specific facts
- Provide context about the document type

## Future Enhancements

Potential additions:
- Pre-built templates for different video styles
- Multi-language support
- Direct integration with HeyGen/Sora/Veo APIs
- Custom aesthetic/branding options
- Video preview in browser
- Batch script generation
- Team collaboration features

## Files Created

- ✅ `src/utils/videoScriptGenerator.ts` - Service
- ✅ `src/components/VideoScriptPreview.tsx` - Component
- 📋 `src/app/api/generate-video-script/route.ts` - API (create from INSTALL_VIDEO_SCRIPT_API.ts)
- 📋 `src/app/video-script/page.tsx` - Page (create from INSTALL_VIDEO_SCRIPT.ts)

## Support

For issues or questions:
1. Check API key configuration
2. Review the generated script structure
3. Verify input summary meets requirements (clear, informative, concise)
