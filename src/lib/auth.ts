import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { JWT } from 'next-auth/jwt';
import connectDB from '@/lib/db';
import User from '@/models/User';

// Extend the JWT type to include our custom fields
interface ExtendedJWT extends JWT {
  id?: string;
  role?: 'participant' | 'admin';
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        await connectDB();
        
        const user = await User.findOne({ email: credentials.email });
        
        if (!user) {
          throw new Error('No user found with this email');
        }
        
        const isPasswordValid = await user.comparePassword(credentials.password);
        
        if (!isPasswordValid) {
          throw new Error('Invalid password');
        }
        
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET || "your-secret-key-for-jwt-tokens",
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      const extendedToken = token as ExtendedJWT;
      if (user) {
        extendedToken.id = user.id;
        extendedToken.role = user.role;
      }
      return extendedToken;
    },
    async session({ session, token }) {
      const extendedToken = token as ExtendedJWT;
      if (extendedToken.id) {
        session.user.id = extendedToken.id;
      }
      if (extendedToken.role) {
        session.user.role = extendedToken.role;
      }
      return session;
    },
  },
};