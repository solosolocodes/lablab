import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Wallet from '@/models/Wallet';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Get all wallets (with optional filtering by owner or scenario)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is admin
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get('ownerId');
    const scenarioId = searchParams.get('scenarioId');
    
    // Create filter based on query parameters
    const filter: any = {};
    if (ownerId) filter.owner = ownerId;
    if (scenarioId) filter.scenarioId = scenarioId;
    
    // Find wallets and populate owner field
    const wallets = await Wallet.find(filter)
      .populate('owner', '_id name email role')
      .sort({ createdAt: -1 });
    
    // Format the response
    const formattedWallets = wallets.map(wallet => ({
      id: wallet._id,
      name: wallet.name,
      description: wallet.description,
      owner: {
        id: wallet.owner._id,
        name: wallet.owner.name,
        email: wallet.owner.email,
        role: wallet.owner.role,
      },
      assets: wallet.assets,
      scenarioId: wallet.scenarioId,
      createdAt: wallet.createdAt,
    }));
    
    return NextResponse.json(formattedWallets);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching wallets:', error);
    return NextResponse.json(
      { message: 'Error fetching wallets', error: errorMessage },
      { status: 500 }
    );
  }
}

// Create a new wallet
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is admin
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { name, description, ownerId, assets = [], scenarioId = null } = await request.json();

    if (!name || !description || !ownerId) {
      return NextResponse.json(
        { message: 'Name, description, and owner ID are required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Create wallet
    const wallet = await Wallet.create({
      name,
      description,
      owner: new mongoose.Types.ObjectId(ownerId),
      assets,
      scenarioId: scenarioId ? new mongoose.Types.ObjectId(scenarioId) : undefined,
    });
    
    // Populate owner for the response
    await wallet.populate('owner', '_id name email role');
    
    // Return successful response
    return NextResponse.json({
      message: 'Wallet created successfully',
      wallet: {
        id: wallet._id,
        name: wallet.name,
        description: wallet.description,
        owner: {
          id: wallet.owner._id,
          name: wallet.owner.name,
          email: wallet.owner.email,
          role: wallet.owner.role,
        },
        assets: wallet.assets,
        scenarioId: wallet.scenarioId,
        createdAt: wallet.createdAt,
      }
    }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error creating wallet:', error);
    return NextResponse.json(
      { message: 'Error creating wallet', error: errorMessage },
      { status: 500 }
    );
  }
}

// Update a wallet
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is admin
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { id, name, description, ownerId, assets, scenarioId } = await request.json();

    if (!id || !name || !description || !ownerId) {
      return NextResponse.json(
        { message: 'ID, name, description, and owner ID are required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Check if wallet exists
    const wallet = await Wallet.findById(id);
    if (!wallet) {
      return NextResponse.json(
        { message: 'Wallet not found' },
        { status: 404 }
      );
    }
    
    // Update fields
    wallet.name = name;
    wallet.description = description;
    wallet.owner = new mongoose.Types.ObjectId(ownerId);
    wallet.assets = assets || [];
    wallet.scenarioId = scenarioId ? new mongoose.Types.ObjectId(scenarioId) : undefined;
    
    // Save changes
    await wallet.save();
    
    // Populate owner for the response
    await wallet.populate('owner', '_id name email role');
    
    // Return successful response
    return NextResponse.json({
      message: 'Wallet updated successfully',
      wallet: {
        id: wallet._id,
        name: wallet.name,
        description: wallet.description,
        owner: {
          id: wallet.owner._id,
          name: wallet.owner.name,
          email: wallet.owner.email,
          role: wallet.owner.role,
        },
        assets: wallet.assets,
        scenarioId: wallet.scenarioId,
        createdAt: wallet.createdAt,
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error updating wallet:', error);
    return NextResponse.json(
      { message: 'Error updating wallet', error: errorMessage },
      { status: 500 }
    );
  }
}

// Delete a wallet
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is admin
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'Wallet ID is required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Find and delete the wallet
    const result = await Wallet.findByIdAndDelete(id);
    
    if (!result) {
      return NextResponse.json(
        { message: 'Wallet not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: 'Wallet deleted successfully'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error deleting wallet:', error);
    return NextResponse.json(
      { message: 'Error deleting wallet', error: errorMessage },
      { status: 500 }
    );
  }
}