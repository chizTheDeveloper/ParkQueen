import React, { useState, useRef, useEffect } from 'react';
import { Star, ShieldCheck, MapPin, Plus, Camera, Clock, ChevronDown, ChevronLeft, Car, X, Check, Search, Navigation, User, Mail, Smartphone, Upload } from 'lucide-react';
import L from 'leaflet';

const MOCK_LISTINGS = [
  {
    id: '101',
    title: 'Private Driveway - UWS',
    description: 'Secure driveway behind locked gate. 24/7 access.',
    pricePerHour: 15,
    image: 'https://picsum.photos/400/300?random=1',
    rating: 4.8,
    reviews: 42,
    hostName: 'James',
    hostId: 'h1',
    lat: 35,
    lng: 55,
    amenities: ['CCTV', 'Gated', 'EV Charging']
  },
  {
    id: '102',
    title: 'SoHo Garage Spot',
    description: 'Underground heated garage. Very tight turn, small cars only.',
    pricePerHour: 25,
    image: 'https://picsum.photos/400/300?random=2',
    rating: 4.5,
    reviews: 18,
    hostName: 'Elena',
    hostId: 'h2',
    lat: 65,
    lng: 30,
    amenities: ['Heated', 'Attendant']
  },
  {
    id: '103',
    title: 'Brooklyn Brownstone Spot',
    description: 'Easy street access, no alternate side parking worries.',
    pricePerHour: 10,
    image: 'https://picsum.photos/400/300?random=3',
    rating: 4.9,
    reviews: 120,
    hostName: 'Marcus',
    hostId: 'h3',
    lat: 45,
    lng: 80,
    amenities: ['Wide', 'Well Lit']
  },
];

const MY_LISTINGS = [
   {
    id: 'm1',
    title: 'My Backyard Spot',
    description: 'Spacious spot in Queens.',
    pricePerHour: 12,
    image: 'https://picsum.photos/400/300?random=10',
    rating: 5.0,
    reviews: 4,
    hostName: 'You',
    hostId: 'me',
    lat: 0,
    lng: 0,
    amenities: ['Private']
  }
];

// --- Sub-Components ---

const TimePicker = ({ label, value, onChange, onClose }) => {
  const [hour, setHour] = useState(value ? parseInt(value.split(':')[0]) : 9);
  const [minute, setMinute] = useState(value ? parseInt(value.split(':')[1].split(' ')[0]) : 0);
  const [period, setPeriod] = useState(value ? value.split(' ')[1] : 'AM');

  return (
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-dark-800 w-full max-w-sm sm:rounded-2xl rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 border border-dark-700">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white">{label}</h3>
                  <button onClick={onClose}><X className="text-gray-400" /></button>
              </div>
              
              <div className="flex gap-2 justify-center mb-8 h-48">
                  <div className="flex-1 overflow-y-auto no-scrollbar bg-dark-900 rounded-xl border border-dark-700 text-center py-2">
                      <div className="text-xs text-gray-500 mb-2 font-bold uppercase">Hour</div>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => (
                          <button key={h} onClick={() => setHour(h)} className={`block w-full py-2 ${hour === h ? 'text-queen-400 font-bold text-xl bg-queen-900/20' : 'text-gray-400'}`}>
                              {h}
                          </button>
                      ))}
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar bg-dark-900 rounded-xl border border-dark-700 text-center py-2">
                       <div className="text-xs text-gray-500 mb-2 font-bold uppercase">Min</div>
                      {[0, 15, 30, 45].map(m => (
                          <button key={m} onClick={() => setMinute(m)} className={`block w-full py-2 ${minute === m ? 'text-queen-400 font-bold text-xl bg-queen-900/20' : 'text-gray-400'}`}>
                              {m.toString().padStart(2, '0')}
                          </button>
                      ))}
                  </div>
                  <div className="flex-1 bg-dark-900 rounded-xl border border-dark-700 text-center py-2 flex flex-col justify-center gap-2">
                       <button onClick={() => setPeriod('AM')} className={`py-3 rounded-lg mx-2 ${period === 'AM' ? 'bg-queen-500 text-white font-bold' : 'text-gray-400 hover:bg-dark-800'}`}>AM</button>
                       <button onClick={() => setPeriod('PM')} className={`py-3 rounded-lg mx-2 ${period === 'PM' ? 'bg-queen-500 text-white font-bold' : 'text-gray-400 hover:bg-dark-800'}`}>PM</button>
                  </div>
              </div>

              <button 
                onClick={() => {
                    onChange(`${hour}:${minute.toString().padStart(2, '0')} ${period}`);
                    onClose();
                }}
                className="w-full bg-queen-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-queen-500/20"
              >
                  Set Time
              </button>
          </div>
      </div>
  );
};

const CustomDropdown = ({ label, options, value, onChange, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
       <button 
         onClick={() => setIsOpen(!isOpen)}
         className="w-full bg-dark-800 border border-dark-700 rounded-2xl p-4 flex items-center justify-between group hover:border-queen-500 transition-colors"
       >
         <div className="flex items-center gap-4">
            <div className={`p-2 rounded-xl ${value ? 'bg-queen-900/30 text-queen-400' : 'bg-dark-700 text-gray-500'}`}>
                {Icon ? <Icon size={20} /> : <Car size={20} />}
            </div>
            <div className="text-left">
                <div className="text-xs text-gray-500 mb-0.5">{label}</div>
                <div className={`font-bold ${value ? 'text-white' : 'text-gray-400'}`}>{value || `Select ${label}`}</div>
            </div>
         </div>
         <ChevronDown size={20} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
       </button>
       
       {isOpen && (
         <div className="absolute top-full left-0 right-0 mt-2 bg-dark-800 border border-dark-700 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {options.map((opt) => (
                <button 
                  key={opt}
                  onClick={() => { onChange(opt); setIsOpen(false); }}
                  className="w-full text-left px-5 py-4 hover:bg-dark-700 text-white border-b border-dark-700 last:border-0 font-medium"
                >
                    {opt}
                </button>
            ))}
         </div>
       )}
    </div>
  );
};

const LocationPicker = ({ onConfirm, onBack }) => {
    const mapContainerRef = useRef(null);
    const mapInstance = useRef(null);
    const [address, setAddress] = useState("Brooklyn Westernmost");
    const [subAddress, setSubAddress] = useState("Atlantic Ave, Bay Shore, New York");

    useEffect(() => {
        if (!mapContainerRef.current) return;
        if (mapInstance.current) return;

        const map = L.map(mapContainerRef.current, {
            center: [40.6782, -73.9442],
            zoom: 14,
            zoomControl: false,
            attributionControl: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
             attribution: '&copy; OpenStreetMap & CARTO'
        }).addTo(map);

        const iconHtml = `
           <div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background-image: linear-gradient(to bottom right, #0ea5e9, #0284c7); border: 4px solid white; border-radius: 50%; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
           </div>
        `;

        const icon = L.divIcon({
            html: iconHtml,
            className: 'custom-pin',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        L.marker([40.6782, -73.9442], { icon }).addTo(map);

        mapInstance.current = map;

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[60] bg-dark-900 flex flex-col">
            <div className="absolute top-0 left-0 right-0 p-4 z-[400] flex items-center gap-4 bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={onBack} className="p-2 bg-dark-800/80 backdrop-blur rounded-full text-white hover:bg-dark-700">
                    <ChevronLeft size={24} />
                </button>
                <div className="flex-1 bg-white rounded-xl shadow-lg flex items-center px-4 h-12">
                    <Search className="text-gray-400 mr-2" size={20} />
                    <input type="text" placeholder="Search for area, Street Name" className="flex-1 bg-transparent border-none outline-none text-dark-900 placeholder-gray-400" />
                </div>
            </div>
            <div ref={mapContainerRef} className="flex-1 bg-dark-800 z-0" />
            <div className="bg-white text-dark-900 rounded-t-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 z-10 relative">
                 <button className="w-full mb-6 py-3 border border-gray-200 rounded-xl flex items-center justify-center gap-2 text-queen-600 font-bold hover:bg-gray-50 transition-colors">
                     <Navigation size={18} />
                     Use Current Location
                 </button>
                 <div className="flex items-start gap-3 mb-6">
                     <MapPin className="text-queen-500 shrink-0 mt-1" size={24} fill="currentColor" fillOpacity={0.2} />
                     <div>
                         <h3 className="font-bold text-lg">{address}</h3>
                         <p className="text-gray-500 text-sm">{subAddress}</p>
                     </div>
                 </div>
                 <button onClick={() => onConfirm(`${address}, ${subAddress}`)} className="w-full bg-queen-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-queen-500/30 active:scale-[0.98] transition-all">
                     Save Location
                 </button>
                 <div className="w-32 h-1 bg-gray-300 rounded-full mx-auto mt-4" />
            </div>
        </div>
    );
};

export const GarageRentalView = () => {
  const [activeTab, setActiveTab] = useState('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingSpace, setIsAddingSpace] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [images, setImages] = useState(['https://picsum.photos/200/200?random=8', 'https://picsum.photos/200/200?random=9']);
  const [location, setLocation] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [parkingType, setParkingType] = useState('');
  const [startTime, setStartTime] = useState('09:00 AM');
  const [endTime, setEndTime] = useState('06:00 PM');
  const [activeTimePicker, setActiveTimePicker] = useState(null);

  const filteredListings = MOCK_LISTINGS.filter(l => 
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderAddForm = () => (
      <div className="fixed inset-0 z-50 bg-dark-900 overflow-y-auto no-scrollbar flex flex-col">
          <div className="sticky top-0 bg-dark-900/95 backdrop-blur-md border-b border-dark-800 p-4 flex items-center gap-4 z-10">
              <button onClick={() => setIsAddingSpace(false)} className="p-2 hover:bg-dark-800 rounded-full text-white">
                  <ChevronLeft size={24} />
              </button>
              <h2 className="text-lg font-bold text-white">Add Your Parking Space</h2>
          </div>
          <div className="p-5 space-y-8 pb-32">
              <section>
                  <h3 className="text-gray-400 text-sm mb-3">Upload Space Photo <span className="text-xs opacity-50 block">Max 2 Mb File Upload</span></h3>
                  <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                      <button className="w-24 h-24 shrink-0 rounded-2xl border-2 border-dashed border-queen-500/50 bg-queen-500/10 flex items-center justify-center text-queen-500 hover:bg-queen-500/20 transition-colors">
                          <Camera size={24} />
                      </button>
                      {images.map((img, i) => (
                          <div key={i} className="relative w-24 h-24 shrink-0 rounded-2xl overflow-hidden group">
                              <img src={img} className="w-full h-full object-cover" alt="Upload" />
                              <button className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setImages(images.filter((_, idx) => idx !== i))}>
                                  <X size={12} />
                              </button>
                          </div>
                      ))}
                  </div>
              </section>
              <section className="space-y-4">
                  <h3 className="text-gray-400 text-sm font-medium">Owner Details</h3>
                  <div className="bg-dark-800 border border-dark-700 rounded-2xl px-4 py-3 flex items-center gap-3">
                      <div className="p-2 bg-dark-700 rounded-lg text-gray-400"><User size={18} /></div>
                      <div className="flex-1">
                          <div className="text-[10px] text-gray-500 uppercase font-bold">Parking Name</div>
                          <input type="text" placeholder="Parking Name" className="w-full bg-transparent border-none outline-none text-white placeholder-gray-600 text-sm font-medium" />
                      </div>
                  </div>
                  <div className="bg-dark-800 border border-dark-700 rounded-2xl px-4 py-3 flex items-center gap-3">
                      <div className="p-2 bg-dark-700 rounded-lg text-gray-400"><Mail size={18} /></div>
                      <div className="flex-1">
                          <div className="text-[10px] text-gray-500 uppercase font-bold">Email</div>
                          <input type="email" defaultValue="johandoe@gmail.com" className="w-full bg-transparent border-none outline-none text-white placeholder-gray-600 text-sm font-medium" />
                      </div>
                  </div>
                  <div className="bg-dark-800 border border-dark-700 rounded-2xl px-4 py-3 flex items-center gap-3">
                      <div className="flex items-center gap-1 pr-3 border-r border-dark-600">
                           <img src="https://flagcdn.com/w40/us.png" className="w-5 h-3.5 rounded-sm object-cover" alt="US" />
                           <span className="text-xs font-bold text-white">+1</span>
                      </div>
                      <div className="flex-1">
                          <div className="text-[10px] text-gray-500 uppercase font-bold">Mobile Number</div>
                          <input type="tel" defaultValue="(324) 4589" className="w-full bg-transparent border-none outline-none text-white placeholder-gray-600 text-sm font-medium" />
                      </div>
                  </div>
              </section>
              <section>
                  <h3 className="text-gray-400 text-sm font-medium mb-3">Time Availability</h3>
                  <div className="flex gap-4">
                      <button onClick={() => setActiveTimePicker('start')} className="flex-1 bg-dark-800 border border-dark-700 rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-queen-500 transition-colors text-left">
                          <Clock className="text-queen-500" size={20} />
                          <div>
                              <div className="text-xs text-gray-500">From</div>
                              <div className="text-white font-bold text-lg">{startTime}</div>
                          </div>
                      </button>
                      <button onClick={() => setActiveTimePicker('end')} className="flex-1 bg-dark-800 border border-dark-700 rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-queen-500 transition-colors text-left">
                          <Clock className="text-queen-500" size={20} />
                          <div>
                              <div className="text-xs text-gray-500">To</div>
                              <div className="text-white font-bold text-lg">{endTime}</div>
                          </div>
                      </button>
                  </div>
              </section>
              <section className="space-y-4">
                  <h3 className="text-gray-400 text-sm font-medium">Parking Details</h3>
                  <CustomDropdown label="Vehicle Type" icon={Car} options={['Two Wheeler', 'Four Wheeler', 'SUV Four Wheeler', 'Van/Truck']} value={vehicleType} onChange={setVehicleType} />
                  <CustomDropdown label="Parking Type" icon={MapPin} options={['Garage Parking', 'Driveway', 'Rent Parking', 'Free Parking']} value={parkingType} onChange={setParkingType} />
              </section>
              <section>
                  <h3 className="text-gray-400 text-sm font-medium mb-3">Location</h3>
                  {location ? (
                      <div className="bg-dark-800 border border-queen-500 rounded-2xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <MapPin className="text-queen-500" size={20} />
                              <div>
                                  <div className="font-bold text-white text-sm">{location.split(',')[0]}</div>
                                  <div className="text-xs text-gray-400 truncate max-w-[200px]">{location}</div>
                              </div>
                          </div>
                          <button onClick={() => setIsPickingLocation(true)} className="text-xs text-queen-400 font-bold hover:underline">Change</button>
                      </div>
                  ) : (
                      <button onClick={() => setIsPickingLocation(true)} className="w-full py-4 border border-dashed border-dark-600 rounded-2xl text-queen-400 font-bold flex items-center justify-center gap-2 hover:bg-dark-800 transition-colors">
                          <Plus size={20} />
                          Add New Location
                      </button>
                  )}
              </section>
              <section>
                  <h3 className="text-gray-400 text-sm font-medium mb-3">About</h3>
                  <textarea placeholder="Enter the Parking Space Details" className="w-full bg-dark-800 border border-dark-700 rounded-2xl p-4 text-white min-h-[120px] focus:border-queen-500 outline-none resize-none" />
              </section>
          </div>
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-dark-900 border-t border-dark-800 z-20">
              <button onClick={() => setIsAddingSpace(false)} className="w-full bg-queen-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-queen-500/20 active:scale-[0.98] transition-all">Submit</button>
          </div>
      </div>
  );

  if (isPickingLocation) {
      return <LocationPicker onConfirm={(addr) => { setLocation(addr); setIsPickingLocation(false); }} onBack={() => setIsPickingLocation(false)} />;
  }

  return (
    <div className="pt-20 pb-24 px-4 h-full overflow-y-auto no-scrollbar bg-dark-900">
      {isAddingSpace && renderAddForm()}
      {activeTimePicker && (
          <TimePicker 
            label={activeTimePicker === 'start' ? 'Start Time' : 'End Time'}
            value={activeTimePicker === 'start' ? startTime : endTime}
            onChange={(val) => activeTimePicker === 'start' ? setStartTime(val) : setEndTime(val)}
            onClose={() => setActiveTimePicker(null)}
          />
      )}
      <div className="sticky top-0 z-30 bg-dark-900 pb-4 pt-2">
          <div className="flex bg-dark-800 p-1 rounded-xl border border-dark-700">
              <button onClick={() => setActiveTab('browse')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'browse' ? 'bg-queen-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}>Private Parking</button>
              <button onClick={() => setActiveTab('host')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'host' ? 'bg-queen-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}>My Parking Space</button>
          </div>
      </div>

      {activeTab === 'browse' ? (
        <>
            <div className="mb-6">
                <div className="relative">
                <input
                    type="text"
                    placeholder="Where do you need parking?"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-dark-800 border border-dark-700 text-white rounded-xl py-3 px-4 pl-10 focus:outline-none focus:border-queen-500 transition-colors shadow-sm"
                />
                <MapPin className="absolute left-3 top-3.5 text-gray-500" size={18} />
                </div>
            </div>

            <div className="grid gap-6">
                {filteredListings.map((listing) => (
                <div key={listing.id} className="group bg-dark-800 rounded-2xl overflow-hidden border border-dark-700 hover:border-queen-500/50 transition-all duration-300">
                    <div className="relative h-48 overflow-hidden">
                    <img src={listing.image} alt={listing.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1">
                        <Star size={12} className="text-yellow-400 fill-current" />
                        <span className="text-xs font-bold">{listing.rating}</span>
                    </div>
                    </div>
                    <div className="p-4">
                    <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-lg text-white leading-tight">{listing.title}</h3>
                        <span className="text-queen-400 font-bold">${listing.pricePerHour}<span className="text-xs text-gray-500 font-normal">/hr</span></span>
                    </div>
                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">{listing.description}</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {listing.amenities.map(a => <span key={a} className="text-[10px] uppercase tracking-wider bg-dark-700 text-gray-300 px-2 py-1 rounded">{a}</span>)}
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-dark-700">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold">{listing.hostName[0]}</div>
                            <span className="text-xs text-gray-400">Hosted by {listing.hostName}</span>
                        </div>
                        {listing.hostName === 'James' && (
                        <div className="flex items-center gap-1 text-queen-400">
                            <ShieldCheck size={14} />
                            <span className="text-[10px] font-bold">Superhost</span>
                        </div>
                        )}
                    </div>
                    <button className="w-full mt-4 bg-white text-dark-900 font-bold py-2 rounded-lg hover:bg-queen-100 transition-colors">Reserve</button>
                    </div>
                </div>
                ))}
            </div>
        </>
      ) : (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Your Listed Spots</h2>
                <button className="text-queen-400 text-xs font-bold bg-queen-900/20 px-3 py-1.5 rounded-full border border-queen-500/20">Host Dashboard</button>
            </div>
            <div className="space-y-4 mb-8">
                {MY_LISTINGS.map(item => (
                    <div key={item.id} className="bg-dark-800 border border-dark-700 p-4 rounded-2xl flex gap-4">
                        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                            <img src={item.image} className="w-full h-full object-cover" alt="Thumb" />
                        </div>
                        <div className="flex-1 py-1">
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold text-white">{item.title}</h3>
                                <div className="px-2 py-0.5 bg-green-900/30 text-green-400 text-[10px] font-bold rounded uppercase border border-green-500/20">Active</div>
                            </div>
                            <p className="text-gray-400 text-xs mt-1">{item.description}</p>
                            <div className="mt-3 flex items-center gap-3">
                                <div className="flex items-center gap-1 text-xs text-gray-300">
                                    <Star size={12} className="text-yellow-400 fill-current" />
                                    <span>5.0</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-300">
                                    <Clock size={12} />
                                    <span>$12/hr</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="bg-gradient-to-br from-dark-800 to-dark-800/50 border border-dashed border-dark-600 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-queen-900/30 rounded-full flex items-center justify-center text-queen-400 mb-4 shadow-lg shadow-queen-500/10">
                    <Car size={32} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Rent out your driveway</h3>
                <p className="text-gray-400 text-sm mb-6 max-w-[240px]">Earn passive income by renting your unused parking space to neighbors.</p>
                <button onClick={() => setIsAddingSpace(true)} className="bg-queen-500 hover:bg-queen-600 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-queen-500/30 transition-all flex items-center gap-2">
                    <Plus size={20} />
                    Add Parking Space
                </button>
            </div>
        </div>
      )}
    </div>
  );
};