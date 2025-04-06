import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import UserGroup from '@/models/UserGroup';
import mongoose from 'mongoose';

// Get all user groups
export async function GET() {
  try {
    await connectDB();
    
    // Find all groups and populate the users field with user details
    const groups = await UserGroup.find()
      .populate('users', '_id name email role')
      .sort({ createdAt: -1 });
    
    // Format the response
    const formattedGroups = groups.map(group => ({
      id: group._id,
      name: group.name,
      description: group.description,
      users: group.users.map((user: { _id: string; name: string; email: string; role: string }) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      })),
      experimentsCount: group.experimentsCount,
      createdAt: group.createdAt,
    }));
    
    return NextResponse.json(formattedGroups);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching user groups:', error);
    return NextResponse.json(
      { message: 'Error fetching user groups', error: errorMessage },
      { status: 500 }
    );
  }
}

// Create a new user group
export async function POST(request: NextRequest) {
  try {
    const { name, description, users = [] } = await request.json();

    if (!name || !description) {
      return NextResponse.json(
        { message: 'Name and description are required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Create user group
    const userGroup = await UserGroup.create({
      name,
      description,
      users: users.map((userId: string) => new mongoose.Types.ObjectId(userId)),
      experimentsCount: 0,
    });
    
    // Populate users for the response
    await userGroup.populate('users', '_id name email role');
    
    // Return successful response
    return NextResponse.json({
      message: 'User group created successfully',
      group: {
        id: userGroup._id,
        name: userGroup.name,
        description: userGroup.description,
        users: (userGroup.users as { _id: string; name: string; email: string; role: string }[]).map((user) => ({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        })),
        experimentsCount: userGroup.experimentsCount,
        createdAt: userGroup.createdAt,
      }
    }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error creating user group:', error);
    return NextResponse.json(
      { message: 'Error creating user group', error: errorMessage },
      { status: 500 }
    );
  }
}

// Update a user group
export async function PUT(request: NextRequest) {
  try {
    const { id, name, description, users = [] } = await request.json();

    if (!id || !name || !description) {
      return NextResponse.json(
        { message: 'ID, name, and description are required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Check if group exists
    const group = await UserGroup.findById(id);
    if (!group) {
      return NextResponse.json(
        { message: 'User group not found' },
        { status: 404 }
      );
    }
    
    // Update fields
    group.name = name;
    group.description = description;
    group.users = users.map((userId: string) => new mongoose.Types.ObjectId(userId));
    
    // Save changes
    await group.save();
    
    // Populate users for the response
    await group.populate('users', '_id name email role');
    
    // Return successful response
    return NextResponse.json({
      message: 'User group updated successfully',
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
        users: (group.users as { _id: string; name: string; email: string; role: string }[]).map((user) => ({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        })),
        experimentsCount: group.experimentsCount,
        createdAt: group.createdAt,
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error updating user group:', error);
    return NextResponse.json(
      { message: 'Error updating user group', error: errorMessage },
      { status: 500 }
    );
  }
}

// Delete a user group
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'Group ID is required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Find and delete the group
    const result = await UserGroup.findByIdAndDelete(id);
    
    if (!result) {
      return NextResponse.json(
        { message: 'User group not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: 'User group deleted successfully'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error deleting user group:', error);
    return NextResponse.json(
      { message: 'Error deleting user group', error: errorMessage },
      { status: 500 }
    );
  }
}