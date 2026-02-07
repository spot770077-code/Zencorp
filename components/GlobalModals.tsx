
import React, { useState, useRef, useEffect } from 'react';
import { Catalog, Employee } from '../types';
import { X, Camera, Upload, Phone, MapPin, Hash, Shield, Clock, Download, QrCode, Calendar, User as UserIcon } from 'lucide-react';
import { api } from '../api';

interface GlobalModalsProps {
  activeModal: 'add_employee' | 'add_catalog' | null;
  setActiveModal: (m: 'add_employee' | 'add_catalog' | null) => void;
  catalogs: Catalog[];
  setCatalogs: React.Dispatch<React.SetStateAction<Catalog[]>>;
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  t: any;
  isDarkMode: boolean;
  lang: string;
}

const GlobalModals: React.FC<GlobalModalsProps> = ({
  activeModal, setActiveModal, catalogs, setCatalogs, employees, setEmployees, t, isDarkMode, lang
}) => {
  const [empForm, setEmpForm] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    position: '',
    catalogId: '',
    phoneNumber: '',
    residence: '',
    passportSerial: '',
    passportPIN: '',
    photoUrl: '',
    workingHours: '09:00 - 18:00',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  });

  const [generatedID, setGeneratedID] = useState<string>('');
  const [catForm, setCatForm] = useState({ name: '', positionsString: '' });
  const [isCameraActive, setIsCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [showPinflInput, setShowPinflInput] = useState(false);
  const [pinflValue, setPinflValue] = useState('');
  const [isFetchingData, setIsFetchingData] = useState(false);

  const handleMyIDRequest = async () => {
    if (pinflValue.length !== 14) {
      alert("ПИНФЛ должен быть ровно 14 цифр");
      return;
    }

    setIsFetchingData(true);
    try {
      const response = await fetch('http://localhost:3000/api/myid-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinfl: pinflValue })
      });
      const data = await response.json();

      if (data && !data.error) {
        setEmpForm(prev => ({
          ...prev,
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName,
          passportSerial: data.passportSerial,
          passportPIN: data.passportPIN,
          residence: data.residence,
          photoUrl: data.photoUrl,
          phoneNumber: data.phoneNumber || prev.phoneNumber
        }));
        setShowPinflInput(false);
        setPinflValue('');
      } else {
        alert(data.error || "Ошибка загрузки данных");
      }
    } catch (err) {
      console.error(err);
      alert("Не удалось соединиться с сервером");
    } finally {
      setIsFetchingData(false);
    }
  };

  useEffect(() => {
    if (activeModal === 'add_employee') {
      const unique = `ZEN-ID-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      setGeneratedID(unique);
    }
  }, [activeModal]);

  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { aspectRatio: 3 / 4 } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Ошибка доступа к камере. Убедитесь, что разрешения даны.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (e) { console.error(e); }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = 300; canvas.height = 400;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0, 300, 400);
      setEmpForm({ ...empForm, photoUrl: canvas.toDataURL('image/jpeg') });
      stopCamera();
    }
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.photoUrl) { alert("Сделайте фото или загрузите файл (3x4)"); return; }
    if (empForm.passportPIN.length !== 14) { alert("ПИНФЛ должен быть ровно 14 цифр"); return; }
    if (!empForm.catalogId) { alert("Выберите каталог"); return; }
    if (!empForm.position) { alert("Выберите должность"); return; }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${generatedID}`;

    const newEmp: Employee = {
      ...empForm,
      id: `emp-${Date.now()}`,
      status: 'active',
      qrCode: generatedID,
      qrDataUrl: qrUrl,
      systemLogin: empForm.phoneNumber.replace(/\D/g, '').slice(-6),
      systemPassword: empForm.passportPIN.slice(-4),
      isOnline: false
    } as Employee;

    try {
      const res = await api.addEmployee(newEmp);
      if (res.error) throw new Error(res.error);

      setEmployees(prev => [...prev, newEmp]);
      setActiveModal(null);
      setEmpForm({
        firstName: '', lastName: '', middleName: '', position: '', catalogId: '',
        phoneNumber: '', residence: '', passportSerial: '', passportPIN: '', photoUrl: '',
        workingHours: '09:00 - 18:00', workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
      });
      alert(lang === 'ru' ? "Сотрудник успешно принят в штат!" : "Employee successfully added!");
    } catch (err: any) {
      console.error(err);
      alert(lang === 'ru' ? `Ошибка сохранения: ${err.message || 'Сервер недоступен'}` : `Save failed: ${err.message || 'Server unreachable'}`);
    }
  };

  const handleAddCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    const pos = catForm.positionsString.split(',').map(p => p.trim()).filter(p => p !== '');
    if (!catForm.name || pos.length === 0) {
      alert(lang === 'ru' ? "Заполните название и должности" : "Fill name and positions");
      return;
    }

    const newCat = { id: `cat-${Date.now()}`, name: catForm.name, positions: pos };
    try {
      const res = await api.addCatalog(newCat);
      if (res.error) throw new Error(res.error);

      setCatalogs(prev => [...prev, newCat]);
      setCatForm({ name: '', positionsString: '' });
      setActiveModal(null);
      alert(lang === 'ru' ? "Каталог успешно создан!" : "Catalog successfully created!");
    } catch (err: any) {
      console.error(err);
      alert(lang === 'ru' ? `Ошибка создания каталога: ${err.message || 'Сервер недоступен'}` : `Catalog creation failed: ${err.message || 'Server unreachable'}`);
    }
  };

  const downloadQR = () => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${generatedID}`;
    window.open(qrUrl, '_blank');
  };

  const cardClass = `p-8 rounded-[2.5rem] border shadow-2xl transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100'}`;
  const inputClass = `w-full px-5 py-4 rounded-2xl font-bold outline-none border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-600 text-slate-900 text-sm'}`;
  const labelClass = "text-[10px] font-black text-slate-400 uppercase px-2 tracking-widest mb-1 block";

  if (!activeModal) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[2000] flex items-center justify-center p-4">
      {activeModal === 'add_employee' && (
        <div className={`${cardClass} w-full max-w-5xl max-h-[95vh] flex flex-col p-0 rounded-[3.5rem] overflow-hidden`}>
          <div className="p-8 border-b border-slate-100/10 flex justify-between items-center bg-indigo-600 text-white">
            <h4 className="text-3xl font-black italic tracking-tighter">ZEN<span className="opacity-50">REGISTRY</span></h4>
            <button onClick={() => { setActiveModal(null); if (isCameraActive) stopCamera(); }} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X /></button>
          </div>

          <form onSubmit={handleSaveEmployee} className="p-10 grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-8 overflow-y-auto no-scrollbar">
            <div className="md:col-span-1 space-y-8 flex flex-col items-center">
              <div className="relative group w-52">
                <div className="w-52 h-64 bg-slate-100 dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center overflow-hidden border-4 border-indigo-500 shadow-2xl">
                  {empForm.photoUrl ? <img src={empForm.photoUrl} className="w-full h-full object-cover" /> : <UserIcon className="text-slate-300" size={72} />}
                </div>
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex gap-3">
                  <button type="button" onClick={startCamera} className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl hover:scale-110 transition-transform"><Camera size={20} /></button>
                  <button type="button" onClick={() => photoInputRef.current?.click()} className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl hover:scale-110 transition-transform"><Upload size={20} /></button>
                </div>
                <input ref={photoInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setEmpForm({ ...empForm, photoUrl: ev.target?.result as string });
                    reader.readAsDataURL(f);
                  }
                }} />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 w-full text-center mt-4 text-slate-900">
                <div className="flex justify-center mb-4 bg-white p-3 rounded-3xl inline-block mx-auto">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${generatedID}`} alt="QR" className="w-32 h-32" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Security ID: {generatedID}</p>
                <button type="button" onClick={downloadQR} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg"><Download size={14} /> Скачать QR-Pass</button>
              </div>
            </div>

            <div className={`md:col-span-2 relative overflow-hidden min-h-[400px]`}>
              {/* Main Form Section */}
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-500 transform ${showPinflInput ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
                <div className="md:col-span-2 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h5 className="text-sm font-black uppercase text-indigo-500">Персональная анкета</h5>
                    <button
                      type="button"
                      onClick={() => setShowPinflInput(true)}
                      className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all flex items-center gap-2 group shadow-lg"
                    >
                      <span className="text-[10px] font-bold">Использовать ПИНФЛ</span>
                      <Shield size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                  <hr className="flex-1 ml-4 opacity-10" />
                </div>
                <div className="space-y-1"><label className={labelClass}>Фамилия</label><input required className={inputClass} value={empForm.lastName} onChange={e => setEmpForm({ ...empForm, lastName: e.target.value })} placeholder="Фамилия" /></div>
                <div className="space-y-1"><label className={labelClass}>Имя</label><input required className={inputClass} value={empForm.firstName} onChange={e => setEmpForm({ ...empForm, firstName: e.target.value })} placeholder="Имя" /></div>
                <div className="space-y-1"><label className={labelClass}>Отчество</label><input className={inputClass} value={empForm.middleName} onChange={e => setEmpForm({ ...empForm, middleName: e.target.value })} placeholder="Отчество" /></div>
                <div className="space-y-1"><label className={labelClass}>Телефон</label><input required className={inputClass} value={empForm.phoneNumber} onChange={e => setEmpForm({ ...empForm, phoneNumber: e.target.value })} placeholder="+998" /></div>
                <div className="space-y-1"><label className={labelClass}>Серия паспорта</label><input required className={inputClass} maxLength={9} value={empForm.passportSerial} onChange={e => setEmpForm({ ...empForm, passportSerial: e.target.value.toUpperCase() })} placeholder="AA1234567" /></div>
                <div className="space-y-1"><label className={labelClass}>ПИНФЛ (14 цифр)</label><input required className={inputClass} maxLength={14} value={empForm.passportPIN} onChange={e => setEmpForm({ ...empForm, passportPIN: e.target.value.replace(/\D/g, '') })} placeholder="12345678901234" /></div>
                <div className="md:col-span-2 space-y-1"><label className={labelClass}>Адрес проживания</label><input required className={inputClass} value={empForm.residence} onChange={e => setEmpForm({ ...empForm, residence: e.target.value })} placeholder="Город, Район, Улица..." /></div>
              </div>

              {/* PINFL Entry Section */}
              <div className={`absolute inset-0 flex flex-col items-center justify-center space-y-8 transition-all duration-500 transform ${showPinflInput ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-700 w-full max-w-md shadow-2xl">
                  <h5 className="text-xl font-black text-center mb-6 text-indigo-500 uppercase tracking-tighter">Автозаполнение MyID</h5>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className={labelClass}>Введите ПИНФЛ (14 цифр)</label>
                      <input
                        className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
                        maxLength={14}
                        value={pinflValue}
                        onChange={e => setPinflValue(e.target.value.replace(/\D/g, ''))}
                        placeholder="00000000000000"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isFetchingData || pinflValue.length !== 14}
                      onClick={handleMyIDRequest}
                      className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${isFetchingData || pinflValue.length !== 14 ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white shadow-xl hover:bg-emerald-700 hover:scale-105 active:scale-95'}`}
                    >
                      {isFetchingData ? (
                        <>
                          <Clock className="animate-spin" size={20} />
                          Загрузка...
                        </>
                      ) : (
                        <>
                          <Shield size={20} />
                          Запросить данные
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPinflInput(false)}
                      className="w-full py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-500 transition-colors"
                    >
                      Назад к ручному вводу
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
              <div className="md:col-span-2 flex items-center justify-between pt-4"><h5 className="text-sm font-black uppercase text-indigo-500">Служебные данные</h5><hr className="flex-1 ml-4 opacity-10" /></div>
              <div className="space-y-1">
                <label className={labelClass}>Каталог / Отдел</label>
                <select required className={inputClass} value={empForm.catalogId} onChange={e => setEmpForm({ ...empForm, catalogId: e.target.value, position: '' })}>
                  <option value="">Выберите отдел...</option>
                  {catalogs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Должность</label>
                <select required className={inputClass} value={empForm.position} onChange={e => setEmpForm({ ...empForm, position: e.target.value })}>
                  <option value="">Выберите должность...</option>
                  {catalogs.find(c => c.id === empForm.catalogId)?.positions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>График работы (часы)</label>
                <input required className={inputClass} value={empForm.workingHours} onChange={e => setEmpForm({ ...empForm, workingHours: e.target.value })} placeholder="09:00 - 18:00" />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Рабочие дни</label>
                <div className="flex flex-wrap gap-2 pt-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <button
                      key={day} type="button"
                      onClick={() => {
                        setEmpForm(p => ({
                          ...p,
                          workingDays: p.workingDays.includes(day) ? p.workingDays.filter(d => d !== day) : [...p.workingDays, day]
                        }));
                      }}
                      className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase transition-all ${empForm.workingDays.includes(day) ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="md:col-span-3 flex justify-end gap-6 pt-10 border-t border-slate-100/10 mb-6">
              <button type="button" onClick={() => setActiveModal(null)} className="px-10 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors">Отменить</button>
              <button type="submit" className="px-16 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-200 hover:scale-[1.03] active:scale-95 transition-all">Принять в штат</button>
            </div>
          </form>
          <canvas ref={canvasRef} className="hidden" />

          {isCameraActive && (
            <div className="fixed inset-0 bg-black/98 z-[3000] flex flex-col items-center justify-center p-8">
              <div className="relative w-80 h-[450px] rounded-[3.5rem] overflow-hidden border-8 border-indigo-500 shadow-[0_0_80px_rgba(79,70,229,0.4)]">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 border-[30px] border-black/10 pointer-events-none" />
                <button type="button" onClick={capturePhoto} className="absolute bottom-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-2xl hover:scale-110 active:scale-90 transition-all"><Camera size={36} /></button>
              </div>
              <button type="button" onClick={stopCamera} className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-black/50 backdrop-blur-md text-white rounded-full transition-all shadow-lg z-[3010]">
                <X size={20} />
              </button>
            </div>
          )}
        </div>
      )}

      {activeModal === 'add_catalog' && (
        <div className={`${cardClass} w-full max-w-md animate-in zoom-in-95 my-auto p-10`}>
          <div className="flex justify-between items-center mb-10">
            <h4 className="text-2xl font-black italic tracking-tighter">Создать каталог</h4>
            <button onClick={() => setActiveModal(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl"><X size={20} /></button>
          </div>
          <form onSubmit={handleAddCatalog} className="space-y-8">
            <div className="space-y-1">
              <label className={labelClass}>Имя каталога (Департамент)</label>
              <input required className={inputClass} placeholder="Напр. Бухгалтерия" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Список должностей (через запятую)</label>
              <textarea required className={`${inputClass} h-32 resize-none`} placeholder="Главбух, Кассир, Ревизор..." value={catForm.positionsString} onChange={e => setCatForm({ ...catForm, positionsString: e.target.value })} />
            </div>
            <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100">Инициализировать раздел</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default GlobalModals;
