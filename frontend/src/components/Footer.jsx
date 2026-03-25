import React from 'react';

function Footer() {
    return (
        <footer className="bg-white border-t border-gray-200 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 items-start">
                    {/* Partner Logos & Branding */}
                    <div className="flex flex-col items-center md:items-start space-y-4">
                        <div className="flex items-center gap-3">
                            <img
                                src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Emblem_of_India.svg/220px-Emblem_of_India.svg.png"
                                alt="Government of India"
                                className="h-16 w-auto"
                            />
                            <div>
                                <span className="block font-bold text-gray-900 text-lg leading-tight tracking-tight">Bharat E-Vote</span>
                                <span className="block text-xs font-semibold text-gray-500 uppercase tracking-widest">Government of India</span>
                            </div>
                        </div>
                    </div>

                    {/* Security Disclaimer */}
                    <div className="flex flex-col text-center md:text-right space-y-3">
                        <p className="text-accent-saffron font-bold text-sm tracking-wide uppercase flex items-center justify-center md:justify-end gap-2">
                            <i className="fa-solid fa-graduation-cap"></i> Final Year Project
                        </p>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            This is a demonstration project showcasing a secure, zero-knowledge verifiable e-voting system.
                        </p>
                        <p className="text-xs text-gray-400 font-medium">
                            Technologies: React (Vite), Web3 (Ethers.js), Supabase Edge API, Node.js Prisma
                        </p>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="bg-gray-50 border-t border-gray-100 py-4">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
                    <p className="text-sm font-medium text-gray-500">
                        © {new Date().getFullYear()} Bharat E-Vote | Developed by Adi Bhoir Concept
                    </p>
                    <p className="text-sm text-gray-500 flex items-center gap-1.5">
                        Built with <i className="fa-solid fa-heart text-red-500"></i> using Blockchain
                    </p>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
