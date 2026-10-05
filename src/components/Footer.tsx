import { Link } from 'react-router-dom';
import { Instagram, Facebook, Twitter } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import logoImage from '../assets/logo.png';
import logoDark from '../assets/logodark.png';

export function Footer() {
  const { theme } = useTheme();
  const logoSrc = theme === 'dark' ? logoImage : logoDark;
  const footerSections = [
    {
      title: 'Shop',
      links: [
        { name: 'New Arrivals', path: '#' },
        { name: 'Best Sellers', path: '#' },
        { name: 'Sale', path: '#' },
      ],
    },
    {
      title: 'Company',
      links: [
        { name: 'About Us', path: '/about' },
        { name: 'Contact', path: '/contact' },
        { name: 'Blog', path: '/blog' },
        { name: 'Careers', path: '#' },
      ],
    },
    {
      title: 'Support',
      links: [
        { name: 'FAQ', path: '#' },
        { name: 'Shipping & Returns', path: '#' },
        { name: 'Size Guide', path: '#' },
        { name: 'Terms & Conditions', path: '#' },
      ],
    },
  ];

  const socialLinks = [
    { icon: Instagram, url: '#', name: 'Instagram' },
    { icon: Facebook, url: '#', name: 'Facebook' },
    { icon: Twitter, url: '#', name: 'Twitter' },
  ];

  /** Official marks served locally from `public/payment-logos/` (no hotlinking). */
  const paymentLogos = [
    { src: '/payment-logos/visa.jpeg', alt: 'Visa' },
    { src: '/payment-logos/mastercard.png', alt: 'Mastercard' },
    { src: '/payment-logos/paystack.png', alt: 'Paystack' },
  ];

  return (
    <footer className="bg-ghana-black text-white py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Footer Content */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Info */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14">
                <img
                  src={logoSrc}
                  alt="The Proxy Shop logo"
                  className="h-14 w-auto object-contain"
                  loading="lazy"
                />
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              The Proxy Shop — Premium Menswear for the Modern Gentleman.
            </p>
            <div className="flex space-x-4">
              {socialLinks.map(({ icon: Icon, url, name }) => (
                <a
                  key={name}
                  href={url}
                  className="text-gray-400 hover:text-ghana-green transition-colors"
                  aria-label={name}
                >
                  <Icon size={20} />
                </a>
              ))}
            </div>
          </div>

          {/* Footer Sections */}
          {footerSections.map((section, idx) => (
            <div key={idx}>
              <h4 className="font-semibold text-sm mb-4">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.path}
                      className="text-gray-400 text-sm hover:text-ghana-green transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Payment Methods */}
        <div className="mb-12 pb-12 border-b border-gray-700">
          <p className="text-sm text-gray-400 mb-4">We accept</p>
          <div className="flex flex-wrap items-center gap-3">
            {paymentLogos.map((logo) => (
              <div
                key={logo.alt}
                className="flex h-9 items-center justify-center rounded-md border border-white/10 bg-black px-3"
              >
                <img
                  src={logo.src}
                  alt={logo.alt}
                  loading="lazy"
                  className="h-5 w-auto object-contain sm:h-6"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div className="text-center text-sm text-gray-400">
          <p>
            Copyright © 2026 The Proxy Shop. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
