import { motion } from 'framer-motion';
import { Users, Target, Heart } from 'lucide-react';

export function About() {
  const teamMembers = [
    {
      name: 'Kwesi Mensah',
      role: 'Founder & Creative Director',
      image: 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=400',
    },
    {
      name: 'Ama Osei',
      role: 'Head of Design',
      image: 'https://images.pexels.com/photos/1181599/pexels-photo-1181599.jpeg?auto=compress&cs=tinysrgb&w=400',
    },
    {
      name: 'Kojo Boateng',
      role: 'Production Manager',
      image: 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=400',
    },
    {
      name: 'Abena Asare',
      role: 'Community Lead',
      image: 'https://images.pexels.com/photos/1181599/pexels-photo-1181599.jpeg?auto=compress&cs=tinysrgb&w=400',
    },
  ];

  const values = [
    {
      icon: Target,
      title: 'Authenticity',
      description: 'We stay true to our roots and celebrate genuine Ghanaian culture',
    },
    {
      icon: Users,
      title: 'Community',
      description: 'Every piece is crafted with and for the people who wear it',
    },
    {
      icon: Heart,
      title: 'Quality',
      description: 'Premium materials and meticulous craftsmanship in every item',
    },
  ];

  return (
    <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-ghana-green to-ghana-black text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold mb-6"
          >
            Our Story
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl md:text-2xl text-gray-200 max-w-2xl mx-auto"
          >
            Born in the streets of Accra. Inspired by the people, rhythm, and pride of Ghana.
          </motion.p>
        </div>
      </div>

      {/* Mission Section */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-ghana-black dark:text-white mb-6">
              Our Mission
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
              D'Mayor exists to celebrate Ghanaian culture through fashion and self-expression. We believe that every person deserves to feel confident and connected to their heritage. Our pieces are designed for those who wear their culture with pride, who express their individuality through style, and who understand that fashion is more than clothing—it's a statement.
            </p>
          </motion.div>

          {/* Founding Story */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white dark:bg-ghana-black rounded-lg p-8 md:p-12 border-l-4 border-ghana-green"
          >
            <p className="text-xl text-ghana-black dark:text-white mb-6 leading-relaxed">
              D'Mayor started in 2023 when Kwesi Mensah, a young creative from Accra, noticed a gap in the market. He wanted to see more authentic Ghanaian fashion—pieces that told real stories, celebrated real culture, and were made with real quality. What began as a passion project in a small studio has evolved into a movement.
            </p>
            <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
              Every item is thoughtfully designed and carefully produced. From streetwear to accessories to art pieces, each collection reflects a moment in Ghanaian culture—the energy of Accra's nights, the pride of our heritage, the resilience of our people.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-ghana-yellow to-ghana-red bg-opacity-10">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold text-ghana-black dark:text-white text-center mb-16"
          >
            Our Core Values
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ghana-green text-white mb-6">
                    <Icon size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-ghana-black dark:text-white mb-3">
                    {value.title}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    {value.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold text-ghana-black dark:text-white text-center mb-16"
          >
            Meet Our Team
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {teamMembers.map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center group"
              >
                <div className="mb-4 overflow-hidden rounded-lg h-64">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <h3 className="text-lg font-bold text-ghana-black dark:text-white mb-1">
                  {member.name}
                </h3>
                <p className="text-ghana-green font-semibold text-sm">
                  {member.role}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="bg-ghana-black text-white py-16 md:py-24 px-4"
      >
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">
            Join the Movement
          </h2>
          <p className="text-lg text-gray-300 mb-8">
            Become part of a community celebrating Ghanaian culture, authentic style, and creative expression.
          </p>
          <button className="btn-primary bg-ghana-green text-white">
            Shop D'Mayor Now
          </button>
        </div>
      </motion.section>
    </div>
  );
}
