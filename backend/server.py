from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import asyncio
import random
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="AquaGuard Farming API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Logging configuration
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- MODELS ---

class FarmerInput(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    crop_name: str = Field(..., min_length=1, max_length=100)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    @validator('crop_name')
    def validate_crop_name(cls, v):
        return v.strip().title()

class SoilMoistureData(BaseModel):
    date: datetime
    moisture_percentage: float = Field(..., ge=0, le=100)
    source: str = "NASA-SMAP"
    quality: str = "good"

class RainfallData(BaseModel):
    date: datetime
    rainfall_mm: float = Field(..., ge=0)
    forecast_confidence: float = Field(..., ge=0, le=1)
    source: str = "NASA-GPM"

class IrrigationRecommendation(BaseModel):
    recommendation: str
    confidence: float = Field(..., ge=0, le=1)
    next_irrigation_date: Optional[datetime] = None
    water_amount_mm: Optional[float] = None
    reason: str
    irrigation_status: str  # "immediate", "scheduled", "monitor", "skip"
    urgency_level: str  # "critical", "high", "medium", "low"
    water_deficit_mm: float = 0.0
    days_until_stress: Optional[int] = None
    alternative_actions: List[str] = []
    cost_benefit_note: str = ""

class AlertLevel(BaseModel):
    level: str = Field(..., pattern="^(safe|caution|danger)$")
    color: str
    message: str
    
class FloodDroughtAlert(BaseModel):
    alert_type: str = Field(..., pattern="^(flood|drought)$")
    risk_level: AlertLevel
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DashboardData(BaseModel):
    farmer_input: FarmerInput
    soil_moisture: List[SoilMoistureData]
    rainfall_forecast: List[RainfallData]
    irrigation_recommendation: IrrigationRecommendation
    alerts: List[FloodDroughtAlert]
    last_updated: datetime = Field(default_factory=datetime.utcnow)

# --- MOCK NASA API SERVICES ---

class MockNASAServices:
    """Mock NASA SMAP and GPM services for development"""
    
    @staticmethod
    async def get_soil_moisture(latitude: float, longitude: float, days: int = 7) -> List[SoilMoistureData]:
        """Simulate NASA SMAP soil moisture data"""
        await asyncio.sleep(0.5)  # Simulate API delay
        
        data = []
        base_moisture = random.uniform(15, 45)  # Base soil moisture %
        
        for i in range(days):
            date = datetime.utcnow() - timedelta(days=days-1-i)
            
            # Add realistic variation
            variation = random.uniform(-5, 5)
            seasonal_factor = 10 * math.sin((date.timetuple().tm_yday / 365.0) * 2 * math.pi)
            moisture = max(5, min(95, base_moisture + variation + seasonal_factor))
            
            data.append(SoilMoistureData(
                date=date,
                moisture_percentage=round(moisture, 1),
                source="NASA-SMAP-Mock",
                quality=random.choice(["good", "fair", "good", "good"])
            ))
        
        return data
    
    @staticmethod
    async def get_rainfall_forecast(latitude: float, longitude: float, days: int = 7) -> List[RainfallData]:
        """Simulate NASA GPM rainfall forecast data"""
        await asyncio.sleep(0.3)  # Simulate API delay
        
        data = []
        
        for i in range(days):
            date = datetime.utcnow() + timedelta(days=i)
            
            # Simulate realistic rainfall patterns
            if random.random() < 0.3:  # 30% chance of rain
                rainfall = random.uniform(0.5, 25.0)
                confidence = random.uniform(0.7, 0.95)
            else:
                rainfall = 0.0
                confidence = random.uniform(0.8, 0.98)
            
            data.append(RainfallData(
                date=date,
                rainfall_mm=round(rainfall, 1),
                forecast_confidence=round(confidence, 2),
                source="NASA-GPM-Mock"
            ))
        
        return data

# --- BUSINESS LOGIC SERVICES ---

class IrrigationPlanner:
    """Enhanced irrigation planning logic with detailed recommendations"""
    
    CROP_WATER_REQUIREMENTS = {
        "corn": {
            "min_moisture": 40, "optimal": 60, "critical": 25, "daily_need": 6,
            "water_cost_per_mm": 0.15, "yield_impact_threshold": 30
        },
        "wheat": {
            "min_moisture": 35, "optimal": 55, "critical": 20, "daily_need": 4,
            "water_cost_per_mm": 0.12, "yield_impact_threshold": 25
        },
        "rice": {
            "min_moisture": 80, "optimal": 90, "critical": 70, "daily_need": 8,
            "water_cost_per_mm": 0.20, "yield_impact_threshold": 75
        },
        "tomato": {
            "min_moisture": 45, "optimal": 65, "critical": 30, "daily_need": 5,
            "water_cost_per_mm": 0.18, "yield_impact_threshold": 35
        },
        "soybean": {
            "min_moisture": 40, "optimal": 60, "critical": 25, "daily_need": 5,
            "water_cost_per_mm": 0.14, "yield_impact_threshold": 30
        },
        "default": {
            "min_moisture": 40, "optimal": 60, "critical": 25, "daily_need": 5,
            "water_cost_per_mm": 0.15, "yield_impact_threshold": 30
        }
    }
    
    @classmethod
    def get_irrigation_recommendation(
        cls, 
        crop_name: str, 
        current_moisture: float, 
        rainfall_forecast: List[RainfallData]
    ) -> IrrigationRecommendation:
        
        crop_req = cls.CROP_WATER_REQUIREMENTS.get(crop_name.lower(), cls.CROP_WATER_REQUIREMENTS["default"])
        
        # Calculate rainfall forecasts
        next_24h_rainfall = sum(r.rainfall_mm for r in rainfall_forecast[:1] if r.forecast_confidence > 0.7)
        next_3_days_rainfall = sum(r.rainfall_mm for r in rainfall_forecast[:3] if r.forecast_confidence > 0.7)
        next_7_days_rainfall = sum(r.rainfall_mm for r in rainfall_forecast[:7] if r.forecast_confidence > 0.7)
        
        # Calculate water deficit
        target_moisture = crop_req["optimal"]
        water_deficit_mm = max(0, (target_moisture - current_moisture) / 10 * crop_req["daily_need"])
        
        # Calculate days until crop stress
        stress_threshold = crop_req["critical"]
        daily_moisture_loss = 2.5  # Average daily moisture loss %
        days_until_stress = max(0, (current_moisture - stress_threshold) / daily_moisture_loss) if current_moisture > stress_threshold else 0
        
        # Generate recommendations based on moisture levels
        if current_moisture <= crop_req["critical"]:
            # CRITICAL - Immediate irrigation needed
            water_needed = crop_req["daily_need"] * 2.5
            cost_estimate = water_needed * crop_req["water_cost_per_mm"]
            
            return IrrigationRecommendation(
                recommendation="🚨 CRITICAL: Irrigate immediately to prevent crop damage",
                confidence=0.95,
                next_irrigation_date=datetime.utcnow(),
                water_amount_mm=water_needed,
                reason=f"CRITICAL moisture level ({current_moisture}%) - below stress threshold ({crop_req['critical']}%)",
                irrigation_status="immediate",
                urgency_level="critical",
                water_deficit_mm=water_deficit_mm,
                days_until_stress=0,
                alternative_actions=[
                    "Consider emergency sprinkler irrigation",
                    "Focus on most valuable crop sections first",
                    "Monitor plants for wilting signs"
                ],
                cost_benefit_note=f"Estimated cost: ${cost_estimate:.2f}/acre. Failure to irrigate may result in 30-50% yield loss."
            )
            
        elif current_moisture < crop_req["min_moisture"]:
            # Below minimum - urgent irrigation needed
            if next_24h_rainfall < 3:
                water_needed = crop_req["daily_need"] * 2
                cost_estimate = water_needed * crop_req["water_cost_per_mm"]
                
                return IrrigationRecommendation(
                    recommendation="⚠️ Irrigate within 24 hours",
                    confidence=0.9,
                    next_irrigation_date=datetime.utcnow() + timedelta(hours=12),
                    water_amount_mm=water_needed,
                    reason=f"Moisture ({current_moisture}%) below minimum threshold ({crop_req['min_moisture']}%) with minimal rainfall expected",
                    irrigation_status="immediate",
                    urgency_level="high",
                    water_deficit_mm=water_deficit_mm,
                    days_until_stress=int(days_until_stress),
                    alternative_actions=[
                        "Apply mulch to reduce evaporation",
                        "Increase irrigation frequency but reduce volume",
                        f"Monitor soil moisture twice daily"
                    ],
                    cost_benefit_note=f"Estimated cost: ${cost_estimate:.2f}/acre. Prevents yield reduction of 15-25%."
                )
            else:
                return IrrigationRecommendation(
                    recommendation="🌧️ Monitor closely - rainfall may help",
                    confidence=0.8,
                    next_irrigation_date=datetime.utcnow() + timedelta(days=1),
                    water_amount_mm=crop_req["daily_need"] * 1.5,
                    reason=f"Low moisture but {next_24h_rainfall}mm rainfall expected in 24h",
                    irrigation_status="monitor",
                    urgency_level="medium",
                    water_deficit_mm=water_deficit_mm,
                    days_until_stress=int(days_until_stress),
                    alternative_actions=[
                        "Prepare irrigation equipment for standby",
                        "Check weather forecast updates",
                        "Monitor actual vs forecasted rainfall"
                    ],
                    cost_benefit_note="Wait for natural rainfall to reduce irrigation costs."
                )
        
        elif current_moisture < crop_req["optimal"]:
            # Below optimal - scheduled irrigation recommended
            if next_3_days_rainfall < 8:
                water_needed = crop_req["daily_need"] * 1.2
                cost_estimate = water_needed * crop_req["water_cost_per_mm"]
                
                return IrrigationRecommendation(
                    recommendation="💧 Schedule irrigation within 2-3 days",
                    confidence=0.85,
                    next_irrigation_date=datetime.utcnow() + timedelta(days=2),
                    water_amount_mm=water_needed,
                    reason=f"Moisture adequate ({current_moisture}%) but approaching optimal range ({crop_req['optimal']}%)",
                    irrigation_status="scheduled",
                    urgency_level="medium",
                    water_deficit_mm=water_deficit_mm,
                    days_until_stress=int(days_until_stress),
                    alternative_actions=[
                        "Optimize irrigation timing (early morning/evening)",
                        "Use drip irrigation for efficiency",
                        "Consider split applications"
                    ],
                    cost_benefit_note=f"Estimated cost: ${cost_estimate:.2f}/acre. Maintains optimal growing conditions."
                )
            else:
                return IrrigationRecommendation(
                    recommendation="☔ Skip irrigation - sufficient rainfall expected",
                    confidence=0.9,
                    next_irrigation_date=None,
                    water_amount_mm=0,
                    reason=f"Adequate moisture with {next_3_days_rainfall}mm rainfall forecast over 3 days",
                    irrigation_status="skip",
                    urgency_level="low",
                    water_deficit_mm=0,
                    days_until_stress=int(days_until_stress),
                    alternative_actions=[
                        "Monitor rainfall accuracy",
                        "Prepare for post-rain soil assessment",
                        "Focus on other farm maintenance"
                    ],
                    cost_benefit_note="Natural rainfall saves irrigation costs while maintaining crop health."
                )
        
        else:
            # Optimal or above - no irrigation needed
            return IrrigationRecommendation(
                recommendation="✅ No irrigation needed - optimal conditions",
                confidence=0.95,
                next_irrigation_date=None,
                water_amount_mm=0,
                reason=f"Soil moisture excellent at {current_moisture}% (optimal: {crop_req['optimal']}%)",
                irrigation_status="skip",
                urgency_level="low",
                water_deficit_mm=0,
                days_until_stress=int(days_until_stress) if days_until_stress > 0 else 14,
                alternative_actions=[
                    "Focus on pest and disease monitoring",
                    "Plan fertilizer application schedule",
                    "Maintain irrigation equipment"
                ],
                cost_benefit_note="Excellent conditions - continue monitoring for changes."
            )

class AlertSystem:
    """Flood and drought alert system"""
    
    @classmethod
    def generate_alerts(
        cls, 
        soil_moisture_data: List[SoilMoistureData],
        rainfall_forecast: List[RainfallData]
    ) -> List[FloodDroughtAlert]:
        
        alerts = []
        
        # Current moisture level
        current_moisture = soil_moisture_data[-1].moisture_percentage if soil_moisture_data else 50
        
        # Rainfall analysis
        next_24h_rainfall = sum(r.rainfall_mm for r in rainfall_forecast[:1])
        next_72h_rainfall = sum(r.rainfall_mm for r in rainfall_forecast[:3])
        
        # Drought analysis - check moisture trend
        if len(soil_moisture_data) >= 3:
            recent_moisture_trend = [d.moisture_percentage for d in soil_moisture_data[-3:]]
            moisture_declining = all(
                recent_moisture_trend[i] <= recent_moisture_trend[i-1] 
                for i in range(1, len(recent_moisture_trend))
            )
            
            if current_moisture < 20 and moisture_declining:
                alerts.append(FloodDroughtAlert(
                    alert_type="drought",
                    risk_level=AlertLevel(
                        level="danger",
                        color="red",
                        message=f"Severe drought risk: {current_moisture}% moisture with declining trend"
                    )
                ))
            elif current_moisture < 30:
                alerts.append(FloodDroughtAlert(
                    alert_type="drought",
                    risk_level=AlertLevel(
                        level="caution",
                        color="yellow",
                        message=f"Moderate drought risk: {current_moisture}% moisture level"
                    )
                ))
        
        # Flood analysis
        if next_24h_rainfall > 50:
            alerts.append(FloodDroughtAlert(
                alert_type="flood",
                risk_level=AlertLevel(
                    level="danger",
                    color="red",
                    message=f"High flood risk: {next_24h_rainfall}mm rain forecast in 24h"
                )
            ))
        elif next_72h_rainfall > 75:
            alerts.append(FloodDroughtAlert(
                alert_type="flood",
                risk_level=AlertLevel(
                    level="caution",
                    color="yellow",
                    message=f"Moderate flood risk: {next_72h_rainfall}mm rain forecast in 72h"
                )
            ))
        
        # If no alerts, add safe status
        if not alerts:
            alerts.append(FloodDroughtAlert(
                alert_type="flood",
                risk_level=AlertLevel(
                    level="safe",
                    color="green",
                    message="No significant flood or drought risks detected"
                )
            ))
        
        return alerts

# --- API ENDPOINTS ---

@api_router.get("/")
async def root():
    return {"message": "AquaGuard Farming API - Soil Moisture & Rainfall Insights"}

@api_router.post("/farmer-input", response_model=FarmerInput)
async def submit_farmer_input(farmer_data: FarmerInput):
    """Submit farmer location and crop information"""
    try:
        farmer_dict = farmer_data.dict()
        await db.farmer_inputs.insert_one(farmer_dict)
        logger.info(f"Farmer input submitted for {farmer_data.crop_name} at ({farmer_data.latitude}, {farmer_data.longitude})")
        return farmer_data
    except Exception as e:
        logger.error(f"Error saving farmer input: {e}")
        raise HTTPException(status_code=500, detail="Error saving farmer input")

@api_router.get("/farmer-inputs", response_model=List[FarmerInput])
async def get_farmer_inputs():
    """Get all farmer inputs"""
    try:
        inputs = await db.farmer_inputs.find().to_list(100)
        return [FarmerInput(**inp) for inp in inputs]
    except Exception as e:
        logger.error(f"Error fetching farmer inputs: {e}")
        raise HTTPException(status_code=500, detail="Error fetching farmer inputs")

@api_router.get("/soil-moisture/{farmer_id}")
async def get_soil_moisture(farmer_id: str):
    """Get soil moisture data for a farmer location"""
    try:
        # Get farmer data
        farmer_data = await db.farmer_inputs.find_one({"id": farmer_id})
        if not farmer_data:
            raise HTTPException(status_code=404, detail="Farmer not found")
        
        # Get soil moisture data from NASA SMAP (mocked)
        moisture_data = await MockNASAServices.get_soil_moisture(
            farmer_data["latitude"], 
            farmer_data["longitude"]
        )
        
        return moisture_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching soil moisture: {e}")
        raise HTTPException(status_code=500, detail="Error fetching soil moisture data")

@api_router.get("/rainfall-forecast/{farmer_id}")
async def get_rainfall_forecast(farmer_id: str):
    """Get rainfall forecast data for a farmer location"""
    try:
        # Get farmer data
        farmer_data = await db.farmer_inputs.find_one({"id": farmer_id})
        if not farmer_data:
            raise HTTPException(status_code=404, detail="Farmer not found")
        
        # Get rainfall forecast from NASA GPM (mocked)
        rainfall_data = await MockNASAServices.get_rainfall_forecast(
            farmer_data["latitude"], 
            farmer_data["longitude"]
        )
        
        return rainfall_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching rainfall forecast: {e}")
        raise HTTPException(status_code=500, detail="Error fetching rainfall forecast")

@api_router.get("/irrigation-plan/{farmer_id}")
async def get_irrigation_plan(farmer_id: str):
    """Get irrigation recommendation for a farmer"""
    try:
        # Get farmer data
        farmer_data = await db.farmer_inputs.find_one({"id": farmer_id})
        if not farmer_data:
            raise HTTPException(status_code=404, detail="Farmer not found")
        
        # Get current data
        moisture_data = await MockNASAServices.get_soil_moisture(
            farmer_data["latitude"], farmer_data["longitude"], days=3
        )
        rainfall_forecast = await MockNASAServices.get_rainfall_forecast(
            farmer_data["latitude"], farmer_data["longitude"], days=7
        )
        
        # Generate recommendation
        current_moisture = moisture_data[-1].moisture_percentage if moisture_data else 50
        recommendation = IrrigationPlanner.get_irrigation_recommendation(
            farmer_data["crop_name"], current_moisture, rainfall_forecast
        )
        
        return recommendation
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating irrigation plan: {e}")
        raise HTTPException(status_code=500, detail="Error generating irrigation plan")

@api_router.get("/alerts/{farmer_id}")
async def get_alerts(farmer_id: str):
    """Get flood and drought alerts for a farmer"""
    try:
        # Get farmer data
        farmer_data = await db.farmer_inputs.find_one({"id": farmer_id})
        if not farmer_data:
            raise HTTPException(status_code=404, detail="Farmer not found")
        
        # Get current data
        moisture_data = await MockNASAServices.get_soil_moisture(
            farmer_data["latitude"], farmer_data["longitude"], days=7
        )
        rainfall_forecast = await MockNASAServices.get_rainfall_forecast(
            farmer_data["longitude"], farmer_data["longitude"], days=3
        )
        
        # Generate alerts
        alerts = AlertSystem.generate_alerts(moisture_data, rainfall_forecast)
        
        return alerts
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating alerts: {e}")
        raise HTTPException(status_code=500, detail="Error generating alerts")

@api_router.get("/dashboard/{farmer_id}", response_model=DashboardData)
async def get_dashboard_data(farmer_id: str):
    """Get complete dashboard data for a farmer"""
    try:
        # Get farmer data
        farmer_data = await db.farmer_inputs.find_one({"id": farmer_id})
        if not farmer_data:
            raise HTTPException(status_code=404, detail="Farmer not found")
        
        farmer_input = FarmerInput(**farmer_data)
        
        # Fetch all required data
        soil_moisture = await MockNASAServices.get_soil_moisture(
            farmer_data["latitude"], farmer_data["longitude"], days=7
        )
        rainfall_forecast = await MockNASAServices.get_rainfall_forecast(
            farmer_data["latitude"], farmer_data["longitude"], days=7
        )
        
        # Generate recommendations and alerts
        current_moisture = soil_moisture[-1].moisture_percentage if soil_moisture else 50
        irrigation_recommendation = IrrigationPlanner.get_irrigation_recommendation(
            farmer_data["crop_name"], current_moisture, rainfall_forecast
        )
        alerts = AlertSystem.generate_alerts(soil_moisture, rainfall_forecast)
        
        dashboard_data = DashboardData(
            farmer_input=farmer_input,
            soil_moisture=soil_moisture,
            rainfall_forecast=rainfall_forecast,
            irrigation_recommendation=irrigation_recommendation,
            alerts=alerts
        )
        
        return dashboard_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching dashboard data: {e}")
        raise HTTPException(status_code=500, detail="Error fetching dashboard data")

# Health check
@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "AquaGuard API",
        "timestamp": datetime.utcnow(),
        "version": "1.0.0"
    }

# Include the router in the main app
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()