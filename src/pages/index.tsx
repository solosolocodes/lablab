import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-purple-50 to-white">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-purple-800 mb-4">Welcome to LabLab</h1>
        <p className="text-lg text-gray-600 mb-8">
          A secure platform for participants and administrators to collaborate on research projects.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          {/* Participant Access */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-purple-100 flex flex-col">
            <h2 className="text-xl font-semibold text-purple-700 mb-3">Participant Access</h2>
            <p className="text-gray-600 mb-6 flex-grow">
              Join research studies, track your progress, and contribute to groundbreaking research.
            </p>
            <div className="flex flex-col space-y-3">
              <Link 
                href="/participant/login"
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
              >
                Log In as Participant
              </Link>
              <Link 
                href="/participant/register"
                className="w-full py-2 border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
              >
                Register as Participant
              </Link>
            </div>
          </div>
          
          {/* Administrator Access */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-purple-100 flex flex-col">
            <h2 className="text-xl font-semibold text-purple-700 mb-3">Administrator Access</h2>
            <p className="text-gray-600 mb-6 flex-grow">
              Manage research projects, monitor participant data, and analyze results.
            </p>
            <div className="flex flex-col space-y-3">
              <Link 
                href="/admin/login"
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
              >
                Log In as Admin
              </Link>
              <Link 
                href="/admin/register"
                className="w-full py-2 border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
              >
                Register as Admin
              </Link>
            </div>
          </div>
        </div>
        
        <div className="mt-12 text-sm text-gray-500">
          © {new Date().getFullYear()} LabLab Platform. All rights reserved.
        </div>
      </div>
    </div>
  );
}