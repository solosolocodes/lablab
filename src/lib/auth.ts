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
    // Admin authentication provider (with password)
    CredentialsProvider({
      id: 'admin-login',
      name: 'Admin Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        await connectDB();
        
        const user = await User.findOne({ 
          email: credentials.email,
          role: 'admin'
        });
        
        if (!user) {
          throw new Error('No admin account found with this email');
        }
        
        if (!user.password) {
          throw new Error('Admin account requires a password');
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
    
    // Participant authentication provider (email-only)
    CredentialsProvider({
      id: 'participant-login',
      name: 'Participant Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          throw new Error('Email is required');
        }

        await connectDB();
        
        const user = await User.findOne({ 
          email: credentials.email,
          role: 'participant'
        });
        
        if (!user) {
          throw new Error('No participant found with this email');
        }
        
        // For participants, we just verify they exist in the database
        // No password check needed
        
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