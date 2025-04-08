'use client';

import { useState, useEffect, useRef } from 'react';

interface BuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: {
    id: string;
    symbol: string;
    name: string;
    amount: number;
  };
  currentPrice: number;
  availableFunds: number;
  onConfirmBuy: (assetId: string, quantity: number, totalCost: number) => Promise<boolean>;
}

export default function BuyModal({ 
  isOpen, 
  onClose, 
  asset, 
  currentPrice, 
  availableFunds,
  onConfirmBuy
}: BuyModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionSuccess, setTransactionSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Calculate maximum purchasable amount based on available funds
  const maxPurchasable = Math.floor(availableFunds / currentPrice);
  const totalCost = quantity * currentPrice;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setError(null);
      setTransactionSuccess(false);
      setIsProcessing(false);
    }
  }, [isOpen]);

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        if (!isProcessing && !transactionSuccess) {
          onClose();
        }
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, isProcessing, transactionSuccess]);

  // Auto-close after successful transaction
  useEffect(() => {
    if (transactionSuccess) {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [transactionSuccess, onClose]);

  // Handle quantity change from slider
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuantity(parseInt(e.target.value));
  };

  // Handle quantity change from input field
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 1 && value <= maxPurchasable) {
      setQuantity(value);
    }
  };

  // Handle buy confirmation
  const handleConfirmBuy = async () => {
    if (quantity <= 0 || totalCost > availableFunds) {
      setError("Invalid transaction amount");
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      const success = await onConfirmBuy(asset.id, quantity, totalCost);
      
      if (success) {
        setTransactionSuccess(true);
      } else {
        setError("Transaction failed. Please try again.");
      }
    } catch (err) {
      setError("An error occurred during the transaction");
      console.error("Buy transaction error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center">
      <div 
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 relative"
      >
        {/* Modal header */}
        <div className="bg-blue-600 text-white rounded-t-lg p-4">
          <h3 className="text-xl font-bold">Buy {asset.symbol}</h3>
          <p className="text-blue-100 text-sm">{asset.name}</p>
        </div>
        
        {/* Modal content */}
        <div className="p-5">
          {/* Transaction status message */}
          {transactionSuccess && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path>
                </svg>
                <span className="text-green-700 font-medium">Purchase successful!</span>
              </div>
              <p className="text-green-600 text-sm mt-1">
                You bought {quantity} {asset.symbol} for ${totalCost.toFixed(2)}
              </p>
            </div>
          )}
          
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span className="text-red-700 font-medium">Error</span>
              </div>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          )}
          
          {/* Asset details */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="text-sm text-gray-500">Current Price</div>
              <div className="text-lg font-mono font-bold text-gray-900">${currentPrice.toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="text-sm text-gray-500">Available USD</div>
              <div className="text-lg font-mono font-bold text-gray-900">${availableFunds.toFixed(2)}</div>
            </div>
          </div>
          
          {/* Purchase amount selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select quantity to buy
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input 
                type="range" 
                min="1" 
                max={maxPurchasable} 
                value={quantity}
                onChange={handleSliderChange}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                disabled={isProcessing || transactionSuccess || maxPurchasable === 0}
              />
              <input
                type="number"
                min="1"
                max={maxPurchasable}
                value={quantity}
                onChange={handleInputChange}
                className="w-16 p-2 border border-gray-300 rounded-md text-center"
                disabled={isProcessing || transactionSuccess || maxPurchasable === 0}
              />
            </div>
            <div className="text-xs text-gray-500 text-right">
              Max: {maxPurchasable} {asset.symbol}
            </div>
          </div>
          
          {/* Transaction summary */}
          <div className="bg-blue-50 p-4 rounded-lg mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-blue-800">Quantity:</span>
              <span className="font-medium">{quantity} {asset.symbol}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-blue-800">Price per unit:</span>
              <span className="font-medium">${currentPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-blue-100">
              <span className="text-blue-800 font-medium">Total Cost:</span>
              <span className="font-bold text-lg">${totalCost.toFixed(2)}</span>
            </div>
          </div>
          
          {/* Warning if not enough funds */}
          {totalCost > availableFunds && (
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded mb-4">
              Not enough USD available for this purchase
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex justify-between gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md transition-colors"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmBuy}
              className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                totalCost <= availableFunds && !isProcessing && !transactionSuccess
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              disabled={totalCost > availableFunds || isProcessing || transactionSuccess || maxPurchasable === 0}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : transactionSuccess ? (
                'Complete'
              ) : (
                'Confirm Buy'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}