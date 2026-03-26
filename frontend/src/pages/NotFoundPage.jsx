import React from 'react';
import { Link } from 'react-router-dom';

function NotFoundPage() {
    return (
        <main id="main-content" className="min-h-screen bg-[#f3f4f6] flex flex-col items-center justify-center p-6 text-center">
            <div className="gov-card max-w-lg w-full p-10">
                <div className="w-20 h-20 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-6 border border-red-200">
                    <i className="fa-solid fa-triangle-exclamation text-3xl"></i>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">404 — Page Not Found</h1>
                <p className="text-gray-500 mb-8">
                    The page you are looking for does not exist or has been moved.
                </p>
                <Link to="/" className="btn-primary px-8 py-3 text-lg">
                    <i className="fa-solid fa-home mr-2"></i> Return to Home
                </Link>
            </div>
        </main>
    );
}

export default NotFoundPage;
