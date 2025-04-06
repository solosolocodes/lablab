import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, role = 'participant' } = await request.json();

    // Validate based on role
    if (role === 'admin' && (!name || !email || !password)) {
      return NextResponse.json(
        { message: 'Name, email, and password are required for admin accounts' },
        { status: 400 }
      );
    } else if (role === 'participant' && (!name || !email)) {
      return NextResponse.json(
        { message: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Validate role
    if (role !== 'participant' && role !== 'admin') {
      return NextResponse.json(
        { message: 'Invalid role specified' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { message: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Create user based on role
    const userData = role === 'admin' 
      ? { name, email, password, role } 
      : { name, email, role };
      
    const user = await User.create(userData);

    // Return success but don't include password
    return NextResponse.json(
      {
        message: 'User registered successfully',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Registration error:', error);
    return NextResponse.json(
      { message: 'Error registering user', error: errorMessage },
      { status: 500 }
    );
  }
}