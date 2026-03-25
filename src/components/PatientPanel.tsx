'use client';

import { User, Calendar, Cpu, Clock, Activity } from 'lucide-react';
import { PatientInfo } from '@/types';

interface Props {
  patient: PatientInfo;
  onChange: (updated: PatientInfo) => void;
}

interface FieldConfig {
  key: keyof PatientInfo;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
}

export default function PatientPanel({ patient, onChange }: Props) {
  const fields: FieldConfig[] = [
    {
      key: 'name',
      label: 'Patient Name',
      icon: <User className="w-3.5 h-3.5" />,
      placeholder: 'e.g. John Doe',
    },
    {
      key: 'age',
      label: 'Age',
      icon: <User className="w-3.5 h-3.5" />,
      placeholder: 'e.g. 54',
    },
    {
      key: 'recordingDate',
      label: 'Recording Date',
      icon: <Calendar className="w-3.5 h-3.5" />,
      placeholder: 'e.g. 2026-03-25',
    },
    {
      key: 'deviceId',
      label: 'Device ID',
      icon: <Cpu className="w-3.5 h-3.5" />,
      placeholder: 'e.g. HLT-001',
    },
    {
      key: 'duration',
      label: 'Duration',
      icon: <Clock className="w-3.5 h-3.5" />,
      placeholder: 'e.g. 30s',
    },
    {
      key: 'sampleRate',
      label: 'Sample Rate',
      icon: <Activity className="w-3.5 h-3.5" />,
      placeholder: 'e.g. 500 Hz',
    },
  ];

  const handleChange = (key: keyof PatientInfo, value: string) => {
    onChange({ ...patient, [key]: value });
  };

  return (
    <div className="bg-surface-1 border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(0,255,136,0.15)' }}>
          <User className="w-3.5 h-3.5" style={{ color: '#00ff88' }} />
        </div>
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Patient Information</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {fields.map(({ key, label, icon, placeholder }) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="flex items-center gap-1.5 text-[10px] text-muted uppercase tracking-wider">
              <span className="text-subtle">{icon}</span>
              {label}
            </label>
            <input
              type="text"
              value={patient[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={placeholder}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs text-white placeholder-subtle focus:outline-none focus:border-[#00ff88]/40 transition-colors"
              style={{ WebkitUserSelect: 'text', userSelect: 'text' } as React.CSSProperties}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
