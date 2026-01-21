import React from 'react';
import { ArrowLeft } from 'lucide-react';

const NOTIFICATIONS = [
  { id: '1', name: 'Brooklyn westernmost', action: 'Parking Available', status: 'Near you', address: '487, Atlantic AveBay', distance: '50 m', img: 'https://i.pravatar.cc/150?u=10' },
  { id: '2', name: 'Aliquam dui', action: 'Parking Available', status: 'Near you', address: '598, Laoreet eros tincidunt', distance: '70 m', img: 'https://i.pravatar.cc/150?u=20' },
  { id: '3', name: 'Phasellus donec', action: 'Parking Available', status: 'Near you', address: '897, Proin blandit lacus', distance: '1 km', img: 'https://i.pravatar.cc/150?u=33' },
  { id: '4', name: 'Fnsectr kdipiscing', action: 'Parking Available', status: 'Near you', address: '489, Rlementum sollicitudin', distance: '2 km', img: 'https://i.pravatar.cc/150?u=44' },
  { id: '5', name: 'Phasellus fringilla nec', action: 'Parking Available', status: 'Near you', address: '89, Augue ac semper', distance: '3 km', img: 'https://i.pravatar.cc/150?u=55' },
  { id: '6', name: 'Praesent lacinia', action: 'Parking Available', status: 'Near you', address: '002, Mauris porta non', distance: '3.5 km', img: 'https://i.pravatar.cc/150?u=66' },
  { id: '7', name: 'Lobortis vulpu', action: 'Parking Available', status: 'Near you', address: '264, Proin blandit lacus', distance: '4 km', img: 'https://i.pravatar.cc/150?u=77' },
  { id: '8', name: 'Efi citur lacinia', action: 'Parking Available', status: 'Near you', address: '487, Atlantic AveBay', distance: '4.5 km', img: 'https://i.pravatar.cc/150?u=88' },
  { id: '9', name: 'Quis porttitor risus', action: 'Parking Available', status: 'Near you', address: '338, Mauris porta non', distance: '5 km', img: 'https://i.pravatar.cc/150?u=99' },
];

export const NotificationsView = ({ onBack }) => {
  return (
    <div className="h-full bg-dark-900 flex flex-col pt-4">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-4 border-b border-dark-800">
         <button 
            onClick={onBack} 
            className="p-2 -ml-2 text-white hover:bg-dark-800 rounded-full transition-colors"
         >
            <ArrowLeft size={24} />
         </button>
         <h1 className="text-xl font-bold text-white">Notification</h1>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
         {NOTIFICATIONS.map((item, index) => (
           <div 
            key={item.id} 
            className={`flex items-start gap-4 p-4 border-b border-dark-800 hover:bg-dark-800/50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-dark-900' : 'bg-[#151515]'}`}
           >
              {/* Avatar Image */}
              <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-dark-700 shadow-sm">
                 <img src={item.img} alt="User" className="w-full h-full object-cover" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                 <div className="flex flex-wrap items-baseline gap-x-1 mb-1">
                    <span className="font-bold text-white text-sm leading-tight">{item.name}</span>
                    <span className="text-gray-400 text-sm leading-tight">{item.action}</span>
                 </div>
                 
                 <div className="text-queen-400 text-xs font-bold mb-1 tracking-wide">{item.status}</div>
                 
                 <div className="text-gray-500 text-xs truncate">{item.address}</div>
              </div>

              {/* Distance */}
              <div className="text-gray-400 text-xs font-medium whitespace-nowrap self-end mb-1">
                 {item.distance}
              </div>
           </div>
         ))}
      </div>
    </div>
  );
};
