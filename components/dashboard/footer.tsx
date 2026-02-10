export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white px-6 py-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
        <p>&copy; {new Date().getFullYear()} PIXTRACE. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-gray-600 transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-gray-600 transition-colors">
            Terms of Service
          </a>
          <a href="#" className="hover:text-gray-600 transition-colors">
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}
