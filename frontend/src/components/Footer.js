import React from 'react';

function Footer() {
    return (
        <footer className="security-footer">
            {/* Partner Logos */}
            <div className="footer-logos">
                <div className="footer-logo">
                    <img
                        src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg"
                        alt="Government of India"
                    />
                    <span>Government of India</span>
                </div>
                <div className="footer-logo">
                    <img
                        src="https://upload.wikimedia.org/wikipedia/en/thumb/e/e8/Digital_India_logo.svg/220px-Digital_India_logo.svg.png"
                        alt="Digital India"
                    />
                    <span>Digital India</span>
                </div>
                <div className="footer-logo">
                    <img
                        src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/National_Informatics_Centre_logo.svg/200px-National_Informatics_Centre_logo.svg.png"
                        alt="NIC"
                    />
                    <span>NIC</span>
                </div>
                <div className="footer-logo">
                    <img
                        src="https://www.stqc.gov.in/sites/default/files/stqc_logo.png"
                        alt="STQC"
                    />
                    <span>STQC</span>
                </div>
            </div>

            {/* Security Disclaimer */}
            <div className="footer-disclaimer">
                <p className="warning">
                    <i className="fa-solid fa-graduation-cap"></i> FINAL YEAR PROJECT
                </p>
                <p>
                    This is a demonstration project showcasing a blockchain-based e-voting system.
                    It illustrates how secure electronic voting could work using blockchain technology.
                </p>
                <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.7 }}>
                    Technologies: React.js, Solidity, Ethereum, Node.js, SQLite
                </p>
            </div>

            {/* Bottom Bar */}
            <div className="footer-bottom">
                <p>© 2026 Bharat E-Vote | Final Year Project Demonstration</p>
                <p>
                    Built with ❤️ using Blockchain Technology
                </p>
            </div>
        </footer>
    );
}

export default Footer;
