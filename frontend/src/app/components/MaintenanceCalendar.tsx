import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { useState } from "react";

interface MaintenanceEvent {
  id: string;
  equipment: string;
  type: 'maintenance' | 'overdue' | 'upcoming';
  date: number;
}

export function MaintenanceCalendar() {
  const [currentMonth] = useState(new Date(2024, 2)); // March 2024

  const events: MaintenanceEvent[] = [
    { id: '1', equipment: 'CNC-05', type: 'overdue', date: 10 },
    { id: '2', equipment: 'LC-08', type: 'upcoming', date: 15 },
    { id: '3', equipment: 'RB-12', type: 'upcoming', date: 20 },
    { id: '4', equipment: 'PM-06', type: 'maintenance', date: 25 },
  ];

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getEventsForDay = (day: number) => {
    return events.filter(event => event.date === day);
  };

  const today = new Date().getDate();
  const isCurrentMonth = currentMonth.getMonth() === new Date().getMonth();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">保养日历</h3>
        <div className="flex items-center gap-2">
          <button className="p-1 hover:bg-blue-50 rounded transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <span className="text-sm font-medium text-gray-900 min-w-[100px] text-center">
            2024年3月
          </span>
          <button className="p-1 hover:bg-blue-50 rounded transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
        
        {emptyDays.map((_, index) => (
          <div key={`empty-${index}`} className="aspect-square"></div>
        ))}
        
        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          const isToday = isCurrentMonth && day === today;
          
          return (
            <div
              key={day}
              className={`aspect-square border border-gray-200 rounded-lg p-1 hover:border-blue-300 transition-colors ${
                isToday ? 'bg-blue-50 border-blue-300' : ''
              }`}
            >
              <div className={`text-xs font-medium mb-1 ${
                isToday ? 'text-blue-600' : 'text-gray-900'
              }`}>
                {day}
              </div>
              {dayEvents.map((event) => (
                <div
                  key={event.id}
                  className={`text-[10px] px-1 py-0.5 rounded mb-0.5 truncate ${
                    event.type === 'overdue' ? 'bg-red-100 text-red-700' :
                    event.type === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}
                  title={event.equipment}
                >
                  {event.equipment}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-100 rounded"></div>
          <span className="text-gray-500">已逾期</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-100 rounded"></div>
          <span className="text-gray-500">即将到期</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-100 rounded"></div>
          <span className="text-gray-500">已完成</span>
        </div>
      </div>
    </div>
  );
}
