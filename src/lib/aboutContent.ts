import founderPng from '../assets/founder.png';

export const aboutContent = {
  hero: {
    // Brand half of the kicker is rendered by <GlitchBrand /> in About.tsx
    eyebrow: 'ABOUT',
    title: 'Style should feel considered,\nnot complicated.',
    description:
      'The Proxy Shop is built around a simple idea: getting dressed well should feel easier when the right pieces already work together. We focus on menswear that feels wearable, confident and intentional — without the noise.',
    image: {
      src: 'https://i.pinimg.com/1200x/cc/9c/90/cc9c9002ef9b5f6443430630c5fe0464.jpg',
      alt: 'Editorial menswear portrait with considered everyday styling',
      position: '50% 30%',
    },
  },
  perspective: {
    heading: 'A better edit beats more choice.',
    description:
      'Too many options can make style feel harder than it needs to be. The Proxy Shop is about narrowing that down into a selection that feels useful, wearable and put together. We are not trying to offer everything — only the pieces that make sense: shirts, trousers, hoodies and shoes that can be worn often, styled easily, and worked into real everyday dressing.',
    image: {
      src: 'https://i.pinimg.com/1200x/bc/c1/65/bcc1650022c9b4cc47da9a6d19568084.jpg',
      alt: 'Close editorial crop of layered menswear texture and fit',
      position: '50% 40%',
    },
  },
  focus: {
    eyebrow: 'WHAT WE FOCUS ON',
    heading: 'What the shop is built around.',
    points: [
      {
        number: '01',
        title: 'Everyday Wearability',
        description: 'Pieces that are easy to reach for and easy to style.',
      },
      {
        number: '02',
        title: 'Intentional Selection',
        description: 'A tighter edit instead of endless clutter.',
      },
      {
        number: '03',
        title: 'Better Outfit Building',
        description: 'Clothing and footwear that work together, not in isolation.',
      },
    ],
    images: [
      {
        src: 'https://i.pinimg.com/736x/90/69/5f/90695fa80c5d5c5c961bde445315293c.jpg',
        alt: 'Styled menswear look showing how pieces work as an outfit',
        position: '50% 35%',
      },
      {
        src: 'https://i.pinimg.com/736x/ff/76/e5/ff76e59ea8a82d325d84f30d18381cd1.jpg',
        alt: 'Detail-focused menswear crop for everyday dressing',
        position: '50% 45%',
      },
    ],
    /** Direct image URL placeholder — pin page only; not scraped. Replace with a direct image URL when available. */
    pendingImageUrl: 'https://www.pinterest.com/pin/51721095717964125/',
  },
  founder: {
    eyebrow: 'THE FOUNDER',
    heading: 'Built by one point of view.',
    description:
      'The Proxy Shop reflects a personal approach to menswear — choosing pieces that feel strong, wearable and easy to return to. The goal is not to overwhelm, but to curate a shop that helps customers dress with more clarity and confidence. One founder. One clear point of view on what belongs in the edit.',
    image: founderPng,
    imageAlt: 'Portrait of the founder of The Proxy Shop',
  },
  closing: {
    heading: 'Dress with more intention.',
    description:
      'Whether you are refining your everyday wardrobe or looking for pieces that work harder together, The Proxy Shop is built to make the process simpler.',
    cta: {
      label: 'Explore the Shop',
      href: '/shop',
    },
  },
};
