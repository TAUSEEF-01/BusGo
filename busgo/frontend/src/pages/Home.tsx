import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, MapPin, Search } from "lucide-react";

export function Home() {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (origin && destination && date) {
      navigate(\`/search?origin=\${origin}&destination=\${destination}&date=\${date}\`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-red-600 text-white py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-red-800 mix-blend-multiply opacity-50"></div>
        </div>
        <div className="relative max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Book Bus Tickets the Easy Way
          </h1>
          <p className="text-xl max-w-3xl mx-auto mb-10 text-red-100">
            Find the best deals on bus tickets. Cheap, fast, and reliable.
          </p>

          <form onSubmit={handleSearch} className="bg-white p-4 rounded-lg shadow-xl flex flex-col md:flex-row gap-4 items-center max-w-5xl mx-auto">
            <div className="flex flex-col w-full text-left relative">
              <label className="text-gray-700 text-sm font-bold mb-1 ml-1 flex items-center"><MapPin className="w-4 h-4 mr-1"/> Origin</label>
              <input 
                type="text" 
                value={origin} 
                onChange={(e) => setOrigin(e.target.value)} 
                placeholder="From where?" 
                className="w-full text-gray-900 border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-red-500" 
                required 
              />
            </div>
            
            <div className="flex flex-col w-full text-left relative">
              <label className="text-gray-700 text-sm font-bold mb-1 ml-1 flex items-center"><MapPin className="w-4 h-4 mr-1"/> Destination</label>
              <input 
                type="text" 
                value={destination} 
                onChange={(e) => setDestination(e.target.value)} 
                placeholder="To where?" 
                className="w-full text-gray-900 border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-red-500" 
                required 
              />
            </div>

            <div className="flex flex-col w-full md:w-auto text-left relative">
              <label className="text-gray-700 text-sm font-bold mb-1 ml-1 flex items-center"><Calendar className="w-4 h-4 mr-1"/> Date</label>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                className="w-full md:w-48 text-gray-900 border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-red-500" 
                required 
              />
            </div>

            <button type="submit" className="w-full md:w-auto mt-6 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded transition flex items-center justify-center shadow-md">
              <Search className="w-5 h-5 mr-2" />
              Search Buses
            </button>
          </form>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <p className="text-4xl font-extrabold text-red-600">250M+</p>
              <p className="text-gray-500 mt-2 font-medium">Tickets Sold</p>
            </div>
            <div>
              <p className="text-4xl font-extrabold text-red-600">10M+</p>
              <p className="text-gray-500 mt-2 font-medium">Happy Users</p>
            </div>
            <div>
              <p className="text-4xl font-extrabold text-red-600">50K+</p>
              <p className="text-gray-500 mt-2 font-medium">Bus Operators</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-10">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">1</div>
              <h3 className="text-xl font-semibold mb-2">Search</h3>
              <p className="text-gray-600">Enter your origin, destination, and travel date to find available buses.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">2</div>
              <h3 className="text-xl font-semibold mb-2">Select</h3>
              <p className="text-gray-600">Choose your preferred bus, select your seat, and provide passenger details.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">3</div>
              <h3 className="text-xl font-semibold mb-2">Pay & Go</h3>
              <p className="text-gray-600">Complete payment securely and receive your e-ticket instantly.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}