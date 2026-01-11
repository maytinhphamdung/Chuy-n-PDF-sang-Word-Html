import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Loader2, FileText, Phone } from 'lucide-react';

interface AuthPageProps {
  onLogin: (email: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Basic validation
    if (!email.includes('@')) {
      setError("Email không hợp lệ.");
      setIsLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      setIsLoading(false);
      return;
    }
    
    if (!isLogin && phone.length < 10) {
      setError("Số điện thoại không hợp lệ (tối thiểu 10 số).");
      setIsLoading(false);
      return;
    }

    try {
      // Lấy danh sách user đã lưu trong localStorage
      const storedUsersStr = localStorage.getItem('registered_users');
      const storedUsers = storedUsersStr ? JSON.parse(storedUsersStr) : [];

      if (!isLogin) {
        // --- LOGIC ĐĂNG KÝ ---
        
        // 1. Kiểm tra xem email đã tồn tại chưa
        const userExists = storedUsers.some((u: any) => u.email === email);
        if (userExists) {
          setError("Email này đã được đăng ký. Vui lòng đăng nhập.");
          setIsLoading(false);
          return;
        }

        // 2. Gửi dữ liệu về Webhook (giữ nguyên logic cũ để thu thập lead)
        try {
          await fetch('https://www.aiauto.pro.vn/webhook/6cc76482-a6fa-44a2-a79b-b3e4f246d3ee', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name, phone, email, password,
              timestamp: new Date().toISOString(),
              source: 'PDF Extractor AI App'
            })
          });
        } catch (webhookError) {
          console.warn("Webhook error (non-blocking):", webhookError);
        }

        // 3. Lưu tài khoản mới vào localStorage để sau này đăng nhập lại được
        const newUser = { email, password, name, phone };
        storedUsers.push(newUser);
        localStorage.setItem('registered_users', JSON.stringify(storedUsers));
        
        // 4. Đăng nhập luôn
        onLogin(email);

      } else {
        // --- LOGIC ĐĂNG NHẬP ---

        // Giả lập độ trễ mạng một chút cho mượt
        await new Promise(resolve => setTimeout(resolve, 800));

        // 1. Tìm user trong "database" localStorage
        const user = storedUsers.find((u: any) => u.email === email && u.password === password);

        if (user) {
          onLogin(email);
        } else {
          setError("Email hoặc mật khẩu không chính xác.");
        }
      }
    } catch (err) {
      console.error("Authentication error:", err);
      setError("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-blue-600 p-3 rounded-xl">
             <FileText className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {isLogin ? 'Đăng nhập tài khoản' : 'Đăng ký tài khoản mới'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Hoặc{' '}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              // Reset fields when switching modes
              if (isLogin) {
                  setPhone('');
                  setName('');
              }
            }}
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            {isLogin ? 'tạo tài khoản miễn phí' : 'đăng nhập tài khoản có sẵn'}
          </button>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Họ và tên
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required={!isLogin}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border"
                      placeholder="Nguyễn Văn A"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Số điện thoại
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      required={!isLogin}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border"
                      placeholder="0912345678"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Địa chỉ Email
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border"
                  placeholder="example@email.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Mật khẩu
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    {isLogin ? 'Đăng nhập' : 'Đăng ký'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};