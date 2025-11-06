import { useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, MessageCircle } from 'lucide-react';

export function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccess(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setSuccess(false), 5000);
    } finally {
      setLoading(false);
    }
  };

  const contactInfo = [
    {
      icon: MapPin,
      title: 'Visit Us',
      info: 'Accra, Ghana',
      subinfo: 'By appointment',
    },
    {
      icon: Mail,
      title: 'Email',
      info: 'hello@dmayor.store',
      subinfo: 'Response within 24 hours',
    },
    {
      icon: Phone,
      title: 'WhatsApp',
      info: '+233 XXX XXX XXX',
      subinfo: 'Chat with us live',
    },
  ];

  const faqItems = [
    {
      question: 'What are your shipping times?',
      answer: 'We ship within 2-3 business days. Standard shipping takes 5-7 days within Ghana and 2-3 weeks internationally.',
    },
    {
      question: 'Do you offer refunds or exchanges?',
      answer: 'Yes! We offer 30-day returns and exchanges for unused items in original packaging.',
    },
    {
      question: 'Can I customize my order?',
      answer: 'Absolutely. Reach out to us for custom orders, sizing, or personalization requests.',
    },
    {
      question: "How do I care for my D'Mayor pieces?",
      answer: 'Each item comes with care instructions. Most pieces are best hand-washed in cool water and air-dried.',
    },
  ];

  return (
    <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-ghana-red to-ghana-green text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            Get in Touch
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-100"
          >
            Have questions? We'd love to hear from you. Contact us anytime.
          </motion.p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {/* Contact Info Cards */}
          {contactInfo.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-white dark:bg-ghana-black rounded-lg p-8 text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ghana-green bg-opacity-10 mb-4">
                  <Icon className="text-ghana-green" size={32} />
                </div>
                <h3 className="text-xl font-bold text-ghana-black dark:text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-lg font-semibold text-ghana-green mb-1">{item.info}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{item.subinfo}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Contact Form and Map */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold text-ghana-black dark:text-white mb-8">
              Send us a Message
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-ghana-black dark:text-white mb-2">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-ghana-black dark:text-white mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-ghana-black dark:text-white mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-ghana-black dark:text-white mb-2">
                  Message
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={5}
                  className="input-field resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary bg-ghana-green text-white w-full flex items-center justify-center gap-2"
              >
                <Send size={18} />
                {loading ? 'Sending...' : 'Send Message'}
              </button>

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-lg"
                >
                  Thank you! We'll get back to you soon.
                </motion.div>
              )}
            </form>
          </motion.div>

          {/* Map and WhatsApp */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col gap-8"
          >
            {/* Map */}
            <div className="rounded-lg overflow-hidden h-96 bg-gray-200 dark:bg-gray-800">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3970.0238874953823!2d-0.1876883!3d5.6037386!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1sAccra%2C+Ghana!2sGhana!5e0!3m2!1sen!2s!4v1234567890"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            {/* WhatsApp CTA */}
            <a
              href="https://wa.me/233XXXXXXXXX?text=Hi%20D'Mayor!"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-6 bg-gradient-to-r from-green-400 to-green-600 text-white rounded-lg hover:shadow-lg transition-shadow"
            >
              <MessageCircle size={32} />
              <div>
                <p className="font-bold text-lg">Chat on WhatsApp</p>
                <p className="text-sm text-green-100">Get instant support</p>
              </div>
            </a>
          </motion.div>
        </div>

        {/* FAQ Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-ghana-black dark:text-white text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="max-w-3xl mx-auto space-y-6">
            {faqItems.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-white dark:bg-ghana-black rounded-lg p-6 border-l-4 border-ghana-green"
              >
                <h3 className="text-lg font-bold text-ghana-black dark:text-white mb-3">
                  {item.question}
                </h3>
                <p className="text-gray-700 dark:text-gray-300">{item.answer}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
