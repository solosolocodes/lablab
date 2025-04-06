import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';

// Update a user by ID
export async function PUT(request: NextRequest) {
  try {
    const { id, name, email } = await request.json();

    if (!id || !name || !email) {
      return NextResponse.json(
        { message: 'ID, name, and email are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Find user by ID
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    // Check if email is already taken by another user
    if (email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: id } });
      if (existingUser) {
        return NextResponse.json(
          { message: 'Email is already in use by another user' },
          { status: 409 }
        );
      }
    }

    // Update user
    user.name = name;
    user.email = email;
    await user.save();

    // Return updated user
    return NextResponse.json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('User update error:', error);
    return NextResponse.json(
      { message: 'Error updating user', error: errorMessage },
      { status: 500 }
    );
  }
}

// Get all users (with optional role filtering)
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    // Get role from query parameter if available
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    
    // Create filter if role is specified
    const filter = role ? { role } : {};
    
    // Find users
    const users = await User.find(filter)
      .select('_id name email role createdAt')
      .sort({ createdAt: -1 });
    
    // Map to format we want to return
    const formattedUsers = users.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    }));
    
    return NextResponse.json(formattedUsers);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { message: 'Error fetching users', error: errorMessage },
      { status: 500 }
    );
  }
}