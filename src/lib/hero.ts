export type HeroLayout =
  | 'portrait-right'
  | 'wide-bottom'
  | 'bleed-left'
  | 'portrait-offset';

export type HeroMediaShape = 'portrait' | 'tall' | 'wide' | 'bleed';

export interface HeroChapter {
  id: string;
  number: string;
  category: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  href: string;
  focalPoint?: string;
  layout: HeroLayout;
  mediaShape: HeroMediaShape;
}

export interface HeroWindow<T extends number | string = number> {
  input: number[];
  output: T[];
}

export interface HeroImageMotion {
  opacity: HeroWindow;
  rotateY: HeroWindow;
  rotateX: HeroWindow;
  scale: HeroWindow;
  x: HeroWindow;
  y: HeroWindow;
  clip: HeroWindow<string>;
  parallaxY: HeroWindow;
}

export const heroOpening = {
  /** Text eyebrow removed — opening uses logo-header.png in the narrative. */
  eyebrow: '',
  title: 'Menswear,\nselected with\nintention.',
  description:
    'Everyday essentials shaped around confidence, comfort and considered style.',
  image:
    'https://i.pinimg.com/1200x/38/74/60/387460323983a3ce348b7d012071eaf3.jpg',
  imageAlt:
    'Editorial menswear portrait of a man in a dark overcoat, premium fashion cover styling',
  focalPoint: '50% 30%',
};

export const heroClosing = {
  eyebrow: 'THE PROXY SHOP',
  title: 'Dress with intention.',
  description: 'Build the wardrobe around the way you move.',
  image:
    'https://i.pinimg.com/736x/37/5a/95/375a95c07a3012f37a81604e80450b7f.jpg',
  imageAlt:
    'Campaign-style menswear rail and tailoring detail in a refined boutique setting',
  focalPoint: '50% 45%',
  cta: {
    label: 'Shop the Collection',
    href: '/shop',
  },
};

export const heroChapters: HeroChapter[] = [
  {
    id: 'shirts',
    number: '01',
    category: 'Shirts',
    title: 'Sharp\nfoundations.',
    description: 'Built for everyday presence.',
    image:
      'https://i.pinimg.com/1200x/6e/4e/6c/6e4e6c4b9647353aa0911c427eeba17f.jpg',
    imageAlt:
      'Man wearing a crisp patterned dress shirt, tall editorial portrait crop',
    href: '/shop?category=shirts',
    focalPoint: '55% 25%',
    layout: 'portrait-right',
    mediaShape: 'portrait',
  },
  {
    id: 'trousers',
    number: '02',
    category: 'Trousers',
    title: 'Clean\nlines.',
    description: 'Movement without compromise.',
    image:
      'https://i.pinimg.com/736x/38/9c/d7/389cd73db37f6d08be3a669d8f0d2443.jpg',
    imageAlt:
      'Portrait editorial crop of tailored trousers on a model in a restrained studio setting',
    href: '/shop?category=trousers',
    focalPoint: '50% 45%',
    layout: 'wide-bottom',
    mediaShape: 'portrait',
  },
  {
    id: 'hoodies',
    number: '03',
    category: 'Hoodies',
    title: 'Relaxed\nstructure.',
    description: 'Made for off-duty confidence.',
    image:
      'https://i.pinimg.com/1200x/62/4b/f2/624bf26aa42d6a3acf79b8342f9c61b7.jpg',
    imageAlt:
      'Soft premium hoodie fabric in a relaxed off-duty menswear editorial',
    href: '/shop?category=hoodies',
    focalPoint: '45% 40%',
    layout: 'bleed-left',
    mediaShape: 'bleed',
  },
  {
    id: 'shoes',
    number: '04',
    category: 'Shoes',
    title: 'Finish\nthe look.',
    description: 'From the ground up.',
    image:
      'https://i.pinimg.com/1200x/31/58/70/31587090a26b3995486cb9ff95ddede8.jpg',
    imageAlt:
      'Product-focused pair of premium sneakers shot from a low editorial angle',
    href: '/shop?category=shoes',
    focalPoint: '50% 55%',
    layout: 'portrait-offset',
    mediaShape: 'tall',
  },
];

/**
 * Normalized scroll timeline (~5vh wrapper).
 * Windows are [enterStart, settle, exitStart, exitEnd] unless noted.
 */
export const heroTimeline = {
  openingNarrative: {
    input: [0, 0.06, 0.11],
    output: [1, 1, 0],
  },
  closingNarrative: {
    input: [0.86, 0.92, 1],
    output: [0, 1, 1],
  },
  chapterNarrative: [
    { input: [0.1, 0.15, 0.26, 0.32], output: [0, 1, 1, 0] },
    { input: [0.29, 0.34, 0.45, 0.51], output: [0, 1, 1, 0] },
    { input: [0.48, 0.53, 0.64, 0.7], output: [0, 1, 1, 0] },
    { input: [0.67, 0.72, 0.84, 0.9], output: [0, 1, 1, 0] },
  ],
  openingImageMotion: {
    opacity: { input: [0, 0.02, 0.1, 0.15], output: [1, 1, 1, 0] },
    rotateY: { input: [0, 0.1, 0.15], output: [0, 0, -5] },
    rotateX: { input: [0, 0.1, 0.15], output: [0, 0, 1] },
    scale: { input: [0, 0.1, 0.15], output: [1.04, 1, 1.03] },
    x: { input: [0, 0.15], output: [0, 16] },
    y: { input: [0, 0.15], output: [0, -12] },
    clip: {
      input: [0, 0.04, 0.1, 0.15],
      output: [
        'inset(8% 6% 8% 6%)',
        'inset(0% 0% 0% 0%)',
        'inset(0% 0% 0% 0%)',
        'inset(6% 4% 6% 4%)',
      ],
    },
    parallaxY: { input: [0, 0.15], output: [20, -20] },
  } satisfies HeroImageMotion,
  closingImageMotion: {
    opacity: { input: [0.82, 0.9, 1], output: [0, 1, 1] },
    rotateY: { input: [0.82, 0.92, 1], output: [-5, 0, 0] },
    rotateX: { input: [0.82, 0.92, 1], output: [1, 0, 0] },
    scale: { input: [0.82, 0.92, 1], output: [1.05, 1, 1.01] },
    x: { input: [0.82, 0.92, 1], output: [-14, 0, 0] },
    y: { input: [0.82, 0.92, 1], output: [18, 0, 0] },
    clip: {
      input: [0.82, 0.91, 1],
      output: ['inset(10% 8% 10% 8%)', 'inset(0% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'],
    },
    parallaxY: { input: [0.82, 1], output: [28, -16] },
  } satisfies HeroImageMotion,
  chapterImageMotion: [
    {
      opacity: { input: [0.03, 0.13, 0.27, 0.34], output: [0, 1, 1, 0] },
      rotateY: { input: [0.03, 0.13, 0.27, 0.34], output: [-7, 0, 0, 5] },
      rotateX: { input: [0.03, 0.13, 0.27, 0.34], output: [2, 0, 0, -1] },
      scale: { input: [0.03, 0.13, 0.27, 0.34], output: [1.06, 1, 1, 1.03] },
      x: { input: [0.03, 0.13, 0.27, 0.34], output: [-18, 0, 0, 14] },
      y: { input: [0.03, 0.13, 0.27, 0.34], output: [24, 0, 0, -18] },
      clip: {
        input: [0.03, 0.14, 0.27, 0.34],
        output: [
          'inset(10% 8% 10% 8%)',
          'inset(0% 0% 0% 0%)',
          'inset(0% 0% 0% 0%)',
          'inset(8% 6% 8% 6%)',
        ],
      },
      parallaxY: { input: [0.03, 0.34], output: [36, -36] },
    },
    {
      opacity: { input: [0.26, 0.36, 0.46, 0.53], output: [0, 1, 1, 0] },
      rotateY: { input: [0.26, 0.36, 0.46, 0.53], output: [-7, 0, 0, 5] },
      rotateX: { input: [0.26, 0.36, 0.46, 0.53], output: [2, 0, 0, -1] },
      scale: { input: [0.26, 0.36, 0.46, 0.53], output: [1.06, 1, 1, 1.03] },
      x: { input: [0.26, 0.36, 0.46, 0.53], output: [-18, 0, 0, 14] },
      y: { input: [0.26, 0.36, 0.46, 0.53], output: [24, 0, 0, -18] },
      clip: {
        input: [0.26, 0.37, 0.46, 0.53],
        output: [
          'inset(10% 8% 10% 8%)',
          'inset(0% 0% 0% 0%)',
          'inset(0% 0% 0% 0%)',
          'inset(8% 6% 8% 6%)',
        ],
      },
      parallaxY: { input: [0.26, 0.53], output: [36, -36] },
    },
    {
      opacity: { input: [0.45, 0.55, 0.65, 0.72], output: [0, 1, 1, 0] },
      rotateY: { input: [0.45, 0.55, 0.65, 0.72], output: [-6, 0, 0, 4] },
      rotateX: { input: [0.45, 0.55, 0.65, 0.72], output: [1, 0, 0, -1] },
      scale: { input: [0.45, 0.55, 0.65, 0.72], output: [1.05, 1, 1, 1.02] },
      x: { input: [0.45, 0.55, 0.65, 0.72], output: [-22, 0, 0, 12] },
      y: { input: [0.45, 0.55, 0.65, 0.72], output: [20, 0, 0, -16] },
      clip: {
        input: [0.45, 0.56, 0.65, 0.72],
        output: [
          'inset(6% 12% 6% 0%)',
          'inset(0% 0% 0% 0%)',
          'inset(0% 0% 0% 0%)',
          'inset(6% 8% 6% 4%)',
        ],
      },
      parallaxY: { input: [0.45, 0.72], output: [32, -32] },
    },
    {
      opacity: { input: [0.64, 0.74, 0.88, 0.95], output: [0, 1, 1, 0] },
      rotateY: { input: [0.64, 0.74, 0.88, 0.95], output: [-8, 0, 0, 4] },
      rotateX: { input: [0.64, 0.74, 0.88, 0.95], output: [2, 0, 0, -1] },
      scale: { input: [0.64, 0.74, 0.88, 0.95], output: [1.07, 1, 1, 1.02] },
      x: { input: [0.64, 0.74, 0.88, 0.95], output: [-12, 0, 0, 8] },
      y: { input: [0.64, 0.74, 0.88, 0.95], output: [22, 0, 0, -14] },
      clip: {
        input: [0.64, 0.75, 0.88, 0.95],
        output: [
          'inset(8% 6% 8% 10%)',
          'inset(0% 0% 0% 0%)',
          'inset(0% 0% 0% 0%)',
          'inset(6% 5% 6% 5%)',
        ],
      },
      parallaxY: { input: [0.64, 0.95], output: [36, -30] },
    },
  ] satisfies HeroImageMotion[],
  chapterProgressDots: [
    { input: [0.08, 0.13, 0.27, 0.32], output: [0.3, 1, 1, 0.3] },
    { input: [0.27, 0.33, 0.46, 0.51], output: [0.3, 1, 1, 0.3] },
    { input: [0.46, 0.52, 0.65, 0.7], output: [0.3, 1, 1, 0.3] },
    { input: [0.65, 0.71, 0.86, 0.91], output: [0.3, 1, 1, 0.3] },
  ],
  progressLine: { input: [0.1, 0.88], output: [0, 1] },
  closingVeil: { input: [0.84, 0.9], output: [0, 0.35] },
};

export const heroScroll = {
  wrapperHeightVh: 5,
  spring: { stiffness: 140, damping: 32, mass: 0.35 },
};
