import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// Shadcn UI Components
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Badge } from './components/ui/badge';
import { Alert, AlertDescription } from './components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Separator } from './components/ui/separator';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';

// Icons (using emojis for simplicity)
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Main App Component
function App() {
  return (
    <div className="App">
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard/:farmerId" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

// Landing Page Component
const LandingPage = () => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    latitude: '',
    longitude: '',
    crop_name: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await axios.post(`${API}/farmer-input`, {
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        crop_name: formData.crop_name
      });

      toast.success('Farm data submitted successfully!');
      
      // Redirect to dashboard
      setTimeout(() => {
        window.location.href = `/dashboard/${response.data.id}`;
      }, 1500);

    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Error submitting farm data. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-green-800 mb-4">🌾 AquaGuard Setup</h1>
            <p className="text-gray-600">Enter your farm details to get started with intelligent irrigation planning</p>
          </div>

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Farm Information</CardTitle>
              <CardDescription className="text-center">
                Provide your location and crop details for personalized insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      placeholder="40.7128"
                      value={formData.latitude}
                      onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                      required
                      data-testid="latitude-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      placeholder="-74.0060"
                      value={formData.longitude}
                      onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                      required
                      data-testid="longitude-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="crop">Crop Type</Label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={formData.crop_name}
                    onChange={(e) => setFormData({...formData, crop_name: e.target.value})}
                    required
                    data-testid="crop-select"
                  >
                    <option value="">Select your crop type</option>
                    <option value="corn">Corn</option>
                    <option value="wheat">Wheat</option>
                    <option value="rice">Rice</option>
                    <option value="tomato">Tomato</option>
                    <option value="soybean">Soybean</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="flex gap-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowForm(false)}
                    className="flex-1"
                    data-testid="back-button"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={isSubmitting}
                    data-testid="submit-form-button"
                  >
                    {isSubmitting ? 'Setting up...' : 'Get My Dashboard'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-green-900 via-green-700 to-emerald-600 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1692369584496-3216a88f94c1)',
            opacity: 0.15
          }}
        ></div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-20 lg:py-32">
          <div className="text-center">
            <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight">
              🌾 AquaGuard
            </h1>
            <p className="text-xl lg:text-2xl mb-4 text-green-100 max-w-4xl mx-auto leading-relaxed">
              Smart Farming with NASA Satellite Data
            </p>
            <p className="text-lg lg:text-xl mb-12 text-green-200 max-w-3xl mx-auto">
              Get real-time soil moisture insights, rainfall forecasts, and intelligent irrigation recommendations powered by NASA SMAP and GPM satellite technology.
            </p>
            
            <Button 
              onClick={() => setShowForm(true)}
              className="bg-white text-green-800 hover:bg-green-50 text-lg px-8 py-4 rounded-full font-semibold shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105"
              data-testid="get-started-btn"
            >
              Get Started →
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Powered by NASA Technology</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Advanced satellite data and AI-driven insights for smarter farming decisions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <Card className="text-center hover:shadow-lg transition-all duration-300" data-testid="soil-moisture-feature">
              <CardHeader>
                <div 
                  className="w-full h-48 bg-cover bg-center rounded-lg mb-4"
                  style={{backgroundImage: 'url(https://images.unsplash.com/photo-1743742566156-f1745850281a)'}}
                ></div>
                <CardTitle className="text-green-700">💧 Soil Moisture Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  NASA SMAP satellite data provides accurate soil moisture measurements for optimal irrigation timing.
                </p>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="text-center hover:shadow-lg transition-all duration-300" data-testid="rainfall-forecast-feature">
              <CardHeader>
                <div 
                  className="w-full h-48 bg-cover bg-center rounded-lg mb-4"
                  style={{backgroundImage: 'url(https://images.unsplash.com/photo-1551288049-bebda4e38f71)'}}
                ></div>
                <CardTitle className="text-blue-700">🌧️ Rainfall Forecasts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  NASA GPM precipitation data delivers precise 7-day rainfall predictions for your farm location.
                </p>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="text-center hover:shadow-lg transition-all duration-300" data-testid="irrigation-planner-feature">
              <CardHeader>
                <div 
                  className="w-full h-48 bg-cover bg-center rounded-lg mb-4"
                  style={{backgroundImage: 'url(https://images.unsplash.com/photo-1720071702672-d18c69cb475c)'}}
                ></div>
                <CardTitle className="text-purple-700">🤖 Smart Irrigation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  AI-powered recommendations tell you exactly when and how much to irrigate based on crop needs.
                </p>
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card className="text-center hover:shadow-lg transition-all duration-300" data-testid="alerts-feature">
              <CardHeader>
                <div 
                  className="w-full h-48 bg-cover bg-center rounded-lg mb-4"
                  style={{backgroundImage: 'url(https://images.unsplash.com/photo-1608222351212-18fe0ec7b13b)'}}
                ></div>
                <CardTitle className="text-red-700">⚠️ Risk Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Early flood and drought warnings with color-coded risk levels to protect your crops.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl font-bold text-gray-900 mb-6">NASA-Grade Technology</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <span className="text-green-600 font-bold">SMAP</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Soil Moisture Active Passive</h4>
                    <p className="text-gray-600">Global soil moisture monitoring with 36km resolution</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <span className="text-blue-600 font-bold">GPM</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Global Precipitation Measurement</h4>
                    <p className="text-gray-600">Advanced rainfall detection and forecasting</p>
                  </div>
                </div>
              </div>
            </div>
            <div 
              className="h-96 bg-cover bg-center rounded-xl shadow-lg"
              style={{backgroundImage: 'url(https://images.unsplash.com/photo-1625246333195-78d9c38ad449)'}}
            ></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-green-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold mb-4">🌾 AquaGuard</h3>
          <p className="text-green-200 mb-6">Smart Farming with NASA Satellite Technology</p>
          <p className="text-sm text-green-300">
            Powered by NASA SMAP and GPM satellite data • Built for modern farmers
          </p>
        </div>
      </footer>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const farmerId = window.location.pathname.split('/').pop();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API}/dashboard/${farmerId}`);
        setDashboardData(response.data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    if (farmerId) {
      fetchDashboardData();
    }
  }, [farmerId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your farm dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-8">
            <p className="text-red-600 mb-4">❌ {error || 'Dashboard data not available'}</p>
            <Button onClick={() => window.location.href = '/'} variant="outline">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { farmer_input, soil_moisture, rainfall_forecast, irrigation_recommendation, alerts } = dashboardData;
  const currentMoisture = soil_moisture[soil_moisture.length - 1];
  const totalRainfall = rainfall_forecast.reduce((sum, day) => sum + day.rainfall_mm, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold" data-testid="dashboard-title">🌾 AquaGuard Dashboard</h1>
              <p className="text-green-200">
                {farmer_input.crop_name} Farm • {farmer_input.latitude.toFixed(4)}, {farmer_input.longitude.toFixed(4)}
              </p>
            </div>
            <Button 
              onClick={() => window.location.href = '/'}
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-green-800"
              data-testid="home-button"
            >
              Home
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Alerts Section */}
        <div className="mb-8" data-testid="alerts-section">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🚨 Risk Alerts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alerts.map((alert, index) => (
              <Alert 
                key={index} 
                className={`border-l-4 ${
                  alert.risk_level.level === 'danger' ? 'border-red-500 bg-red-50' :
                  alert.risk_level.level === 'caution' ? 'border-yellow-500 bg-yellow-50' :
                  'border-green-500 bg-green-50'
                }`}
                data-testid={`alert-${alert.alert_type}`}
              >
                <AlertDescription className="font-medium">
                  <Badge 
                    className={`mr-2 ${
                      alert.risk_level.level === 'danger' ? 'bg-red-500' :
                      alert.risk_level.level === 'caution' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                  >
                    {alert.alert_type.toUpperCase()}
                  </Badge>
                  {alert.risk_level.message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card data-testid="current-moisture-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Current Soil Moisture</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {currentMoisture.moisture_percentage}%
              </div>
              <p className="text-sm text-gray-500 mt-1">
                NASA SMAP • {new Date(currentMoisture.date).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="rainfall-forecast-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">7-Day Rainfall Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {totalRainfall.toFixed(1)}mm
              </div>
              <p className="text-sm text-gray-500 mt-1">NASA GPM Forecast</p>
            </CardContent>
          </Card>

          <Card data-testid="next-irrigation-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Next Irrigation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-green-600">
                {irrigation_recommendation.next_irrigation_date 
                  ? new Date(irrigation_recommendation.next_irrigation_date).toLocaleDateString()
                  : 'Not needed'
                }
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {irrigation_recommendation.water_amount_mm || 0}mm recommended
              </p>
            </CardContent>
          </Card>

          <Card data-testid="crop-info-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Crop Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-gray-900">
                {farmer_input.crop_name}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Monitoring since {new Date(farmer_input.created_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3" data-testid="dashboard-tabs">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="irrigation">Irrigation Plan</TabsTrigger>
            <TabsTrigger value="data">Raw Data</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Soil Moisture Chart */}
              <Card data-testid="soil-moisture-chart">
                <CardHeader>
                  <CardTitle>📊 Soil Moisture Trend (7 Days)</CardTitle>
                  <CardDescription>NASA SMAP satellite measurements</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-end justify-between gap-2 border-b border-gray-200">
                    {soil_moisture.map((data, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div 
                          className="bg-blue-500 w-full rounded-t"
                          style={{height: `${(data.moisture_percentage / 100) * 200}px`}}
                        ></div>
                        <span className="text-xs text-gray-500 mt-2">
                          {new Date(data.date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    <p>Current: <span className="font-semibold">{currentMoisture.moisture_percentage}%</span></p>
                    <p>Quality: <span className="font-semibold">{currentMoisture.quality}</span></p>
                  </div>
                </CardContent>
              </Card>

              {/* Rainfall Forecast Chart */}
              <Card data-testid="rainfall-chart">
                <CardHeader>
                  <CardTitle>🌧️ Rainfall Forecast (7 Days)</CardTitle>
                  <CardDescription>NASA GPM precipitation predictions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-end justify-between gap-2 border-b border-gray-200">
                    {rainfall_forecast.map((data, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div 
                          className="bg-blue-400 w-full rounded-t"
                          style={{height: `${Math.max((data.rainfall_mm / 50) * 200, 4)}px`}}
                        ></div>
                        <span className="text-xs text-gray-500 mt-2">
                          {new Date(data.date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    <p>Total forecast: <span className="font-semibold">{totalRainfall.toFixed(1)}mm</span></p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="irrigation" className="space-y-6">
            {/* Main Recommendation Card */}
            <Card data-testid="irrigation-recommendation" className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  💧 Irrigation Recommendation
                  <Badge 
                    className={`${
                      irrigation_recommendation.urgency_level === 'critical' ? 'bg-red-500' :
                      irrigation_recommendation.urgency_level === 'high' ? 'bg-orange-500' :
                      irrigation_recommendation.urgency_level === 'medium' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                  >
                    {irrigation_recommendation.urgency_level?.toUpperCase()}
                  </Badge>
                </CardTitle>
                <CardDescription>AI-powered irrigation guidance for {farmer_input.crop_name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Primary Recommendation */}
                <div className={`p-4 rounded-lg border-l-4 ${
                  irrigation_recommendation.irrigation_status === 'immediate' ? 'bg-red-50 border-l-red-500' :
                  irrigation_recommendation.irrigation_status === 'scheduled' ? 'bg-yellow-50 border-l-yellow-500' :
                  irrigation_recommendation.irrigation_status === 'monitor' ? 'bg-blue-50 border-l-blue-500' :
                  'bg-green-50 border-l-green-500'
                }`}>
                  <h3 className={`font-semibold text-xl mb-2 ${
                    irrigation_recommendation.irrigation_status === 'immediate' ? 'text-red-900' :
                    irrigation_recommendation.irrigation_status === 'scheduled' ? 'text-yellow-900' :
                    irrigation_recommendation.irrigation_status === 'monitor' ? 'text-blue-900' :
                    'text-green-900'
                  }`}>
                    {irrigation_recommendation.recommendation}
                  </h3>
                  <p className={`mb-4 ${
                    irrigation_recommendation.irrigation_status === 'immediate' ? 'text-red-800' :
                    irrigation_recommendation.irrigation_status === 'scheduled' ? 'text-yellow-800' :
                    irrigation_recommendation.irrigation_status === 'monitor' ? 'text-blue-800' :
                    'text-green-800'
                  }`}>
                    {irrigation_recommendation.reason}
                  </p>
                  
                  {/* Cost-Benefit Note */}
                  {irrigation_recommendation.cost_benefit_note && (
                    <div className="mt-3 p-3 bg-white/50 rounded border">
                      <p className="text-sm font-medium text-gray-700">
                        💰 Economic Impact: {irrigation_recommendation.cost_benefit_note}
                      </p>
                    </div>
                  )}
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-lg border">
                    <Label className="text-sm font-medium text-gray-600">Confidence Level</Label>
                    <div className="text-2xl font-bold text-blue-600 mt-1">
                      {Math.round(irrigation_recommendation.confidence * 100)}%
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border">
                    <Label className="text-sm font-medium text-gray-600">Water Amount Needed</Label>
                    <div className="text-2xl font-bold text-blue-600 mt-1">
                      {irrigation_recommendation.water_amount_mm || 0}mm
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {irrigation_recommendation.water_amount_mm > 0 ? 'Per application' : 'None required'}
                    </p>
                  </div>
                  
                  {irrigation_recommendation.water_deficit_mm > 0 && (
                    <div className="bg-white p-4 rounded-lg border">
                      <Label className="text-sm font-medium text-gray-600">Water Deficit</Label>
                      <div className="text-2xl font-bold text-orange-600 mt-1">
                        {irrigation_recommendation.water_deficit_mm.toFixed(1)}mm
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Current shortage</p>
                    </div>
                  )}
                  
                  {irrigation_recommendation.days_until_stress !== null && (
                    <div className="bg-white p-4 rounded-lg border">
                      <Label className="text-sm font-medium text-gray-600">Days Until Stress</Label>
                      <div className={`text-2xl font-bold mt-1 ${
                        irrigation_recommendation.days_until_stress <= 2 ? 'text-red-600' :
                        irrigation_recommendation.days_until_stress <= 5 ? 'text-orange-600' :
                        'text-green-600'
                      }`}>
                        {irrigation_recommendation.days_until_stress || 0}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">At current rate</p>
                    </div>
                  )}
                </div>

                {/* Irrigation Schedule */}
                {irrigation_recommendation.next_irrigation_date && (
                  <Card className="bg-gradient-to-r from-blue-50 to-cyan-50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-blue-900 mb-1">⏰ Next Irrigation Schedule</h4>
                          <p className="text-blue-700">
                            {new Date(irrigation_recommendation.next_irrigation_date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                          <p className="text-sm text-blue-600 mt-1">
                            {new Date(irrigation_recommendation.next_irrigation_date).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })} (recommended time)
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">
                            {irrigation_recommendation.water_amount_mm}mm
                          </div>
                          <p className="text-sm text-blue-600">Water needed</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Alternative Actions */}
                {irrigation_recommendation.alternative_actions && irrigation_recommendation.alternative_actions.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        💡 Alternative Actions & Tips
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-3">
                        {irrigation_recommendation.alternative_actions.map((action, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mt-0.5">
                              {index + 1}
                            </div>
                            <p className="text-gray-700 text-sm flex-1">{action}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Irrigation Status Summary */}
                <Card className="bg-gradient-to-r from-gray-50 to-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">📋 Current Status</h4>
                        <p className="text-gray-700">
                          Status: <span className="font-medium capitalize">{irrigation_recommendation.irrigation_status}</span>
                        </p>
                        <p className="text-gray-700">
                          Priority: <span className="font-medium capitalize">{irrigation_recommendation.urgency_level}</span>
                        </p>
                      </div>
                      <div className={`p-4 rounded-full ${
                        irrigation_recommendation.irrigation_status === 'immediate' ? 'bg-red-100 text-red-600' :
                        irrigation_recommendation.irrigation_status === 'scheduled' ? 'bg-yellow-100 text-yellow-600' :
                        irrigation_recommendation.irrigation_status === 'monitor' ? 'bg-blue-100 text-blue-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {irrigation_recommendation.irrigation_status === 'immediate' ? '🚨' :
                         irrigation_recommendation.irrigation_status === 'scheduled' ? '⏰' :
                         irrigation_recommendation.irrigation_status === 'monitor' ? '👁️' : '✅'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Soil Moisture Data */}
              <Card>
                <CardHeader>
                  <CardTitle>📊 Soil Moisture Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {soil_moisture.map((data, index) => (
                      <div key={index} className="flex justify-between items-center p-2 border-b">
                        <span className="text-sm text-gray-600">
                          {new Date(data.date).toLocaleDateString()}
                        </span>
                        <span className="font-medium">{data.moisture_percentage}%</span>
                        <Badge variant="outline" className="text-xs">
                          {data.quality}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Rainfall Data */}
              <Card>
                <CardHeader>
                  <CardTitle>🌧️ Rainfall Forecast Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {rainfall_forecast.map((data, index) => (
                      <div key={index} className="flex justify-between items-center p-2 border-b">
                        <span className="text-sm text-gray-600">
                          {new Date(data.date).toLocaleDateString()}
                        </span>
                        <span className="font-medium">{data.rainfall_mm}mm</span>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(data.forecast_confidence * 100)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default App;