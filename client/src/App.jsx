import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import LecturerDashboard from './pages/LecturerDashboard';
import AdminPanel from './pages/AdminPanel';
import Reports from './pages/Reports';


// The Security Wrapper
const ProtectedRoute = ({ children, allowedRole }) => {
  const userString = localStorage.getItem('user');

  // 1. Not logged in at all? Kick to the home/login page.
  if (!userString) {
    return <Navigate to="/" replace />;
  }

  try {
    const user = JSON.parse(userString);

    // 2. Logged in, but wrong role? Kick to their proper dashboard.

    if (user.role !== allowedRole) {
  if (user.role === 'Lecturer') return <Navigate to="/lecturer" replace />;
  if (user.role === 'Admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/student" replace />; // Default fallback
}

    // 3. If they pass the checks, let them see the page!
    return children;
    
  } catch (error) {
    // If the data is corrupted, clear it and send them to the login screen safely
    localStorage.removeItem('user');
    return <Navigate to="/" replace />;
  }
};
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
          {/* Locked to Students Only */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRole="Student">
              <StudentDashboard />
            </ProtectedRoute>
          }
         />
      
        
          {/* Locked to Lecturers Only */}
          <Route 
            path="/lecturer" 
            element={
              <ProtectedRoute allowedRole="Lecturer">
                <LecturerDashboard />
              </ProtectedRoute>
            } 
          />
         {/* Locked to System Admins Only */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRole="Admin">
              <AdminPanel />
            </ProtectedRoute>
          } 
        /> 
        {/* Reports can be viewed by Lecturer */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRole="Lecturer">
              <Reports />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
