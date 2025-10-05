import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet, Text, View, ScrollView, TouchableOpacity, Appearance, ActivityIndicator, Keyboard, LogBox, TextInput, FlatList, Modal, Switch, Platform, Linking, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import {
    Accessibility, Volume2, Annoyed, Sun, Moon, Save, Trash2, Bus, Footprints, Car, Bike, X, MapPin, Edit, Settings2, Check, Phone, Bot, Hospital, Bell, MessageSquare, CarFront, ArrowLeft
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';

LogBox.ignoreLogs(['VirtualizedLists should never be nested']);

const GOOGLE_MAPS_API_KEY = 'AIzaSyBDSI8NHH8ANwyjTbgQTq2yKfW3fKmh4U4';

// --- TYPE DEFINITIONS ---
type PreferenceKeys = 'wheelchair' | 'audioNav' | 'lowSensory';
type Preferences = { wheelchair: boolean; audioNav: boolean; lowSensory: boolean; };
type DetailedProfile = { maxSteps: number; requireCurbCuts: boolean; needRestStops: boolean; avoidLoudStreets: boolean; };
type Trip = { id: string; name: string; from: string; to: string; };
type SearchResult = { id: string; type: string; provider: string; duration: string; price: string; distance: string; details?: any; };
type Coordinate = { latitude: number; longitude: number; };
type LocationData = { description: string; location: Coordinate; };
type Suggestion = { description: string; place_id: string; };
type Step = { html_instructions: string; travel_mode: string; };
type TravelMode = 'TRANSIT' | 'DRIVING' | 'BICYCLING';
type Cab = { id: number; name: string; phone: string; price?: string; eta?: string; };

// --- CONSTANTS & HELPERS ---
const TRAVEL_MODES: TravelMode[] = ['TRANSIT', 'DRIVING', 'BICYCLING'];
const ACCESSIBLE_CAB_COMPANIES: Cab[] = [{ id: 1, name: 'Yellow Cab of Pittsburgh', phone: '412-321-8100' }, { id: 2, name: 'Classy Cab', phone: '412-322-5080' }, { id: 3, name: 'Veterans Taxi', phone: '412-481-8387' }, { id: 4, name: 'Communit-T', phone: '412-422-8233' },];
const getTravelModeIcon = (mode: string) => { const icons: { [key: string]: React.ElementType } = { TRANSIT: Bus, DRIVING: Car, BICYCLING: Bike, WALKING: Footprints, 'Ride-Share': Car }; return icons[mode] || Car; };

// --- NEW BRAND COLORS CONSTANT ---
const BRAND_COLORS = {
    teal: "#1BB5A2",
    navy: "#1C274C",
    yellow: "#FFD645",
    white: '#FFFFFF',
};

// --- CUSTOM HOOKS ---
const useDataStorage = () => {
    const [preferences, setPreferences] = useState<Preferences>({ wheelchair: true, audioNav: false, lowSensory: false });
    const [detailedProfile, setDetailedProfile] = useState<DetailedProfile>({ maxSteps: 0, requireCurbCuts: false, needRestStops: false, avoidLoudStreets: false });
    const [savedTrips, setSavedTrips] = useState<Trip[]>([]);

    useEffect(() => { const loadData = async () => { try { const [prefs, detail, trips] = await Promise.all([AsyncStorage.getItem('accessiride-prefs'), AsyncStorage.getItem('accessiride-detail-profile'), AsyncStorage.getItem('accessiride-trips'),]); if (prefs) setPreferences(JSON.parse(prefs)); if (detail) setDetailedProfile(JSON.parse(detail)); if (trips) setSavedTrips(JSON.parse(trips)); } catch (e) { console.error("Failed to load data", e); } }; loadData(); }, []);

    const saveData = async (key: string, value: any) => { try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error(`Failed to save ${key}`, e); } };
    const savePreferences = useCallback((newPrefs: Preferences) => { setPreferences(newPrefs); saveData('accessiride-prefs', newPrefs); }, []);
    const saveDetailedProfile = useCallback((newProfile: DetailedProfile) => { setDetailedProfile(newProfile); saveData('accessiride-detail-profile', newProfile); }, []);
    const addTrip = useCallback((trip: Omit<Trip, 'id'>) => { setSavedTrips(prev => { const newTrip = { ...trip, id: Date.now().toString() }; const updated = [...prev, newTrip]; saveData('accessiride-trips', updated); return updated; }); }, []);
    const removeTrip = useCallback((tripId: string) => { setSavedTrips(prev => { const updated = prev.filter(t => t.id !== tripId); saveData('accessiride-trips', updated); return updated; }); }, []);

    return { preferences, savePreferences, detailedProfile, saveDetailedProfile, savedTrips, addTrip, removeTrip };
};


// --- UI COMPONENTS ---
const IconWrapper = ({ icon: Icon, label, isSelected, onClick, styles }: any) => (<View style={styles.iconWrapperContainer}><TouchableOpacity onPress={onClick} style={[styles.iconWrapperButton, isSelected && styles.iconWrapperButtonSelected]}><Icon size={40} color={isSelected ? 'white' : (styles.iconWrapperLabel.color)} /></TouchableOpacity><Text style={styles.iconWrapperLabel}>{label}</Text></View>);
const ResultCard = ({ option, styles }: { option: SearchResult, styles: any }) => {
    const Icon = getTravelModeIcon(option.type);
    if (option.type === 'TRANSIT' && option.details) {
        return (
            <View style={styles.resultCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Icon size={24} color={styles.label.color} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={styles.resultCardProvider}>{option.provider}</Text>
                        <Text style={styles.resultCardDistance}>From: {option.details.departure_stop.name}</Text>
                        <Text style={styles.resultCardDistance}>To: {option.details.arrival_stop.name}</Text>
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.resultCardDuration}>{option.details.departure_time.text}</Text>
                    <Text style={styles.resultCardPrice}>Arrive {option.details.arrival_time.text}</Text>
                </View>
            </View>
        );
    }
    return (<View style={styles.resultCard}><View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}><Icon size={24} color={styles.label.color} /><View style={{ marginLeft: 12, flex: 1 }}><Text style={styles.resultCardProvider}>{option.provider}</Text><Text style={styles.resultCardDistance}>{option.distance}</Text></View></View><View style={{ alignItems: 'flex-end' }}><Text style={styles.resultCardDuration}>{option.duration}</Text>{option.price && <Text style={styles.resultCardPrice}>{option.price}</Text>}</View></View>);
};
const AccessibilityMap = ({ markers, mapRef, styles }: { markers: Coordinate[], mapRef: React.RefObject<MapView | null>, styles: any }) => (
    <View style={styles.mapContainer}>
        <MapView ref={mapRef} style={styles.map} initialRegion={{ latitude: 40.4406, longitude: -79.9959, latitudeDelta: 0.0922, longitudeDelta: 0.0421 }} provider="google">
            {markers.map((marker, index) => (<Marker key={index} coordinate={marker} title={index === 0 ? 'Start' : 'End'} pinColor={index === 0 ? 'green' : 'red'} />))}
            {markers.length === 2 && (<MapViewDirections origin={markers[0]} destination={markers[1]} apikey={GOOGLE_MAPS_API_KEY} strokeWidth={6} strokeColor={styles.title.color} />)}
        </MapView>
    </View>
);
const DirectionsList = ({ steps, styles }: { steps: Step[], styles: any }) => (
    <View style={styles.card}>
        <Text style={styles.sectionTitle}>Directions</Text>
        {steps.map((step, index) => {
            const Icon = getTravelModeIcon(step.travel_mode);
            const cleanText = step.html_instructions.replace(/<[^>]*>?/gm, '');
            return (
                <View key={index} style={styles.directionStep}>
                    <Icon size={20} color={styles.title.color} />
                    <Text style={styles.directionText}>{cleanText}</Text>
                </View>
            )
        })}
    </View>
);
const LocalCabs = ({ styles, setAnnouncement }: { styles: any, setAnnouncement: (text: string) => void }) => {
    const [botStatus, setBotStatus] = useState<'idle' | 'loading' | 'complete'>('idle');
    const [botResults, setBotResults] = useState<Cab[]>([]);
    const handleBotRequest = () => {
        setBotStatus('loading'); setAnnouncement("AccessiBot is contacting companies...");
        setTimeout(() => {
            const results = ACCESSIBLE_CAB_COMPANIES.map(cab => ({ ...cab, price: `$${(Math.random() * 15 + 20).toFixed(2)}`, eta: `${Math.floor(Math.random() * 10) + 8} min`, }));
            setBotResults(results); setBotStatus('complete'); setAnnouncement("AccessiBot has found your options.");
        }, 2500);
    };

    return (
        <View style={styles.card}>
            <Text style={styles.sectionTitle}>Local Accessible Cabs</Text>
            {botStatus === 'idle' && (
                <>
                    <Text style={[styles.bodyText, { textAlign: 'left', padding: 0, paddingBottom: 12 }]}>Let our bot call local companies to find the best price and availability for you.</Text>
                    <TouchableOpacity style={styles.mainButton} onPress={handleBotRequest}>
                        <Bot size={20} color="white" />
                        <Text style={styles.buttonText}>Request Prices via Bot</Text>
                    </TouchableOpacity>
                </>
            )}
            {botStatus === 'loading' && <ActivityIndicator size="large" color={styles.title.color} />}
            {botStatus === 'complete' && (
                <View>
                    {botResults.map(cab => (
                        <View key={cab.id} style={styles.cabResult}>
                            <View>
                                <Text style={styles.cabName}>{cab.name}</Text>
                                <Text style={styles.cabDetails}>{cab.price} ({cab.eta} ETA)</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity style={styles.cabButton} onPress={() => setAnnouncement(`Simulating booking with ${cab.name}`)}><Text style={styles.cabButtonText}>Select</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.cabCallbackButton} onPress={() => Linking.openURL(`tel:${cab.phone}`)}><Phone size={16} color={styles.label.color} /></TouchableOpacity>
                            </View>
                        </View>
                    ))}
                    <TouchableOpacity style={[styles.mainButton, { backgroundColor: styles.iconWrapperButton.backgroundColor, marginTop: 12 }]} onPress={() => setBotStatus('idle')}>
                        <Text style={[styles.buttonText, { color: styles.label.color }]}>Start Over</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};
const ProfileModal = ({ isVisible, onClose, profile, onSave, styles }: { isVisible: boolean, onClose: () => void, profile: DetailedProfile, onSave: (p: DetailedProfile) => void, styles: any }) => {
    const [tempProfile, setTempProfile] = useState(profile);
    useEffect(() => setTempProfile(profile), [profile]);
    const handleSave = () => { onSave(tempProfile); onClose(); };

    return (
        <Modal visible={isVisible} transparent={true} animationType="slide">
            <View style={styles.modalBackdrop}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Settings2 size={24} color={styles.sectionTitle.color} />
                        <Text style={styles.modalTitle}>Detailed Accessibility Profile</Text>
                        <TouchableOpacity onPress={onClose}><X size={24} color={styles.label.color} /></TouchableOpacity>
                    </View>
                    <Text style={styles.label}>Max steps I can handle (0 for none)</Text>
                    <TextInput style={styles.textInput} keyboardType="number-pad" value={tempProfile.maxSteps.toString()} onChangeText={(t) => setTempProfile(p => ({ ...p, maxSteps: Number(t) || 0 }))} />
                    <View style={styles.switchRow}><Text style={styles.label}>Require curb cuts on sidewalks</Text><Switch value={tempProfile.requireCurbCuts} onValueChange={(v) => setTempProfile(p => ({ ...p, requireCurbCuts: v }))} /></View>
                    <View style={styles.switchRow}><Text style={styles.label}>Need routes with rest stops/benches</Text><Switch value={tempProfile.needRestStops} onValueChange={(v) => setTempProfile(p => ({ ...p, needRestStops: v }))} /></View>
                    <View style={styles.switchRow}><Text style={styles.label}>Prefer to avoid loud streets</Text><Switch value={tempProfile.avoidLoudStreets} onValueChange={(v) => setTempProfile(p => ({ ...p, avoidLoudStreets: v }))} /></View>
                    <TouchableOpacity style={[styles.mainButton, { marginTop: 24 }]} onPress={handleSave}>
                        <Check size={20} color="white" />
                        <Text style={styles.buttonText}>Save Profile</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};


// --- ACCESSIBILITY UI ---
const AccessibilityScreen = ({ onBack, darkMode, setDarkMode }: { onBack: () => void; darkMode: boolean; setDarkMode: (d: boolean) => void }) => {
    const styles = getAccessibilityStyles(darkMode);

    const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
        <View style={styles.featureCard}>
            <View style={{ marginBottom: 12 }}>{icon}</View>
            <Text style={styles.featureCardTitle}>{title}</Text>
            <Text style={styles.featureCardDesc}>{desc}</Text>
        </View>
    );

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerBrand}>
                        <CarFront color={BRAND_COLORS.navy} width={24} height={24} />
                        <Text style={styles.headerBrandText}>WheelRide</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setDarkMode(!darkMode)}
                        style={styles.darkModeButton}
                        accessibilityLabel="Toggle dark mode"
                    >
                        {darkMode ? <Sun size={18} color={BRAND_COLORS.navy} /> : <Moon size={18} color={BRAND_COLORS.navy} />}
                        <Text style={styles.darkModeButtonText}>{darkMode ? "Light" : "Dark"}</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft size={20} color={BRAND_COLORS.teal} />
                    <Text style={styles.backButtonText}>Back to App</Text>
                </TouchableOpacity>

                {/* Hero */}
                <View style={styles.heroSection}>
                    <Text style={styles.heroTitle}>Accessibility Comes First</Text>
                    <Text style={styles.heroSubtitle}>Reliable rides for wheelchair users—especially for clinic and hospital visits.</Text>
                </View>

                {/* Key Features */}
                <View style={styles.section}>
                    <View style={styles.featureGrid}>
                        <FeatureCard icon={<Accessibility color={BRAND_COLORS.teal} size={32} />} title="Wheelchair-Ready" desc="Vehicles equipped with ramps or lifts." />
                        <FeatureCard icon={<Hospital color={BRAND_COLORS.teal} size={32} />} title="Clinic-Focused" desc="Optimized for hospital & therapy visits." />
                        <FeatureCard icon={<Accessibility color={BRAND_COLORS.teal} size={32} />} title="Driver Assist" desc="Drivers trained for mobility support." />
                    </View>
                </View>

                {/* Accessibility Statement */}
                <View style={styles.statementSection}>
                    <Text style={styles.sectionTitle}>Our Commitment to Accessibility</Text>
                    <View style={{ marginTop: 16 }}>
                        <Text style={styles.listItem}>• WCAG 2.1-AA compliant design</Text>
                        <Text style={styles.listItem}>• ADA-supportive interface & testing</Text>
                        <Text style={styles.listItem}>• Continuous user feedback improvements</Text>
                    </View>
                </View>

                {/* Feedback */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tell Us How We Can Improve</Text>
                    <View style={styles.formContainer}>
                        <TextInput aria-label="Your Name" placeholder="Your Name" style={styles.textInput} placeholderTextColor={darkMode ? '#9CA3AF' : '#6B7280'} />
                        <TextInput aria-label="Your Email" placeholder="Your Email" keyboardType="email-address" style={styles.textInput} placeholderTextColor={darkMode ? '#9CA3AF' : '#6B7280'} />
                        <TextInput
                            aria-label="Accessibility feedback"
                            placeholder="Share any barriers or ideas..."
                            multiline
                            numberOfLines={3}
                            style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                            placeholderTextColor={darkMode ? '#9CA3AF' : '#6B7280'}
                        />
                        <TouchableOpacity style={styles.submitButton} onPress={() => Alert.alert("Feedback Submitted!", "Thank you for your feedback.")}>
                            <MessageSquare size={18} color="#fff" />
                            <Text style={styles.submitButtonText}>Submit Feedback</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={{ alignItems: 'center', marginTop: 24 }}>
                        <Text style={styles.bodyText}>Need help booking? Call 24/7:</Text>
                        <TouchableOpacity style={styles.phoneLink} onPress={() => Linking.openURL('tel:180094335743')}>
                            <Phone size={18} color={BRAND_COLORS.teal} />
                            <Text style={styles.phoneLinkText}>1-800-WHEEL-RIDE</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>© {new Date().getFullYear()} WheelRide</Text>
                </View>
            </ScrollView>

            {/* Emergency button */}
            <TouchableOpacity style={styles.emergencyButton} onPress={() => Alert.alert("Emergency Action", "This is a dummy emergency button.")}>
                <Bell size={18} color="#000" />
                <Text style={styles.emergencyButtonText}>Emergency</Text>
            </TouchableOpacity>
        </View>
    );
};


// --- MAIN APP COMPONENT ---
export default function AccessiRideApp() {
    const [from, setFrom] = useState<LocationData | null>(null);
    const [to, setTo] = useState<LocationData | null>(null);
    const [fromText, setFromText] = useState('');
    const [toText, setToText] = useState('');
    const [fromSuggestions, setFromSuggestions] = useState<Suggestion[]>([]);
    const [toSuggestions, setToSuggestions] = useState<Suggestion[]>([]);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const colorScheme = Appearance.getColorScheme();
    const [darkMode, setDarkMode] = useState(colorScheme === 'dark');
    const [mapMarkers, setMapMarkers] = useState<Coordinate[]>([]);
    const [profileModalVisible, setProfileModalVisible] = useState(false);
    const [travelMode, setTravelMode] = useState<TravelMode>('TRANSIT');
    const [departureTime, setDepartureTime] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [directions, setDirections] = useState<Step[]>([]);
    const [showAccessibilityPage, setShowAccessibilityPage] = useState(false);

    const mapRef = useRef<MapView | null>(null);
    const { preferences, savePreferences, detailedProfile, saveDetailedProfile, savedTrips, addTrip, removeTrip } = useDataStorage();

    useEffect(() => { const subscription = Appearance.addChangeListener(({ colorScheme }) => setDarkMode(colorScheme === 'dark')); return () => subscription.remove(); }, []);
    const speak = (text: string) => Speech.speak(text, { language: 'en-US' });
    const togglePreference = useCallback((key: PreferenceKeys) => { const newPrefs = { ...preferences, [key]: !preferences[key] }; savePreferences(newPrefs); const readableKey = key.replace(/([A-Z])/g, ' $1'); speak(`${readableKey} ${newPrefs[key] ? 'enabled' : 'disabled'}.`); }, [preferences, savePreferences]);

    const handleInputChange = async (text: string, type: 'from' | 'to') => {
        if (type === 'from') { setFromText(text); setFrom(null); }
        else { setToText(text); setTo(null); }
        if (text.length > 2) {
            try {
                const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_MAPS_API_KEY}&components=country:us&location=40.4406,-79.9959&radius=50000`;
                const response = await fetch(autocompleteUrl);
                const json = await response.json();
                if (json.predictions) {
                    if (type === 'from') setFromSuggestions(json.predictions);
                    else setToSuggestions(json.predictions);
                }
            } catch (e) { console.error("Autocomplete fetch error:", e); }
        } else {
            if (type === 'from') setFromSuggestions([]);
            else setToSuggestions([]);
        }
    };

    const onSuggestionPress = async (suggestion: Suggestion, type: 'from' | 'to') => {
        Keyboard.dismiss();
        try {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${suggestion.place_id}&key=${GOOGLE_MAPS_API_KEY}&fields=geometry,name`;
            const response = await fetch(detailsUrl);
            const json = await response.json();
            if (json.result?.geometry?.location) {
                const locationData: LocationData = { description: suggestion.description, location: { latitude: json.result.geometry.location.lat, longitude: json.result.geometry.location.lng, } };
                if (type === 'from') { setFrom(locationData); setFromText(locationData.description); setFromSuggestions([]); }
                else { setTo(locationData); setToText(locationData.description); setToSuggestions([]); }
            }
        } catch (e) { console.error("Place details fetch error:", e); }
    };

    const handleSearch = useCallback(async () => {
        Keyboard.dismiss();
        if (!from || !to) { setErrorMessage("Please select a start and destination."); speak("Please select a start and destination."); return; }
        setIsLoading(true); setSearched(true); setErrorMessage(''); setSearchResults([]); setDirections([]);
        const startCoords = from.location; const endCoords = to.location;
        const newMarkers = [startCoords, endCoords]; setMapMarkers(newMarkers);
        speak(`Searching for a route from ${from.description.split(',')[0]} to ${to.description.split(',')[0]}`);
        try {
            const departureTimestamp = travelMode === 'TRANSIT' ? `&departure_time=${Math.floor(departureTime.getTime() / 1000)}` : '';
            const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${startCoords.latitude},${startCoords.longitude}&destination=${endCoords.latitude},${endCoords.longitude}&mode=${travelMode.toLowerCase()}&key=${GOOGLE_MAPS_API_KEY}${departureTimestamp}`;
            const response = await fetch(directionsUrl);
            const json = await response.json();

            if (json.status !== 'OK' || !json.routes || json.routes.length === 0) {
                setErrorMessage(json.error_message || "No routes found."); speak("Sorry, no routes could be found."); setIsLoading(false); return;
            }

            const leg = json.routes[0].legs[0];
            setDirections(leg.steps);
            let results: SearchResult[] = [];
            if (travelMode === 'TRANSIT') {
                leg.steps.forEach((step: any) => {
                    if (step.travel_mode === 'TRANSIT') {
                        results.push({ id: `transit-${step.start_location.lat}`, type: 'TRANSIT', provider: `${step.transit_details.line.short_name || step.transit_details.line.name}`, distance: leg.distance.text, duration: leg.duration.text, price: '$2.75', details: step.transit_details });
                    }
                });
            } else {
                results.push({ id: travelMode.toLowerCase(), type: travelMode, provider: 'Personal Vehicle', duration: leg.duration.text, distance: leg.distance.text, price: '' });
            }

            const distanceInMiles = leg.distance.value / 1609.34;
            const basePrice = 5 + (distanceInMiles * 2.1);
            results.push({ id: 'uberx', type: 'Ride-Share', provider: 'UberX (Est.)', duration: leg.duration.text, distance: leg.distance.text, price: `$${(basePrice).toFixed(2)}` });
            results.push({ id: 'uber-wav', type: 'Ride-Share', provider: 'Uber WAV (Est.)', duration: leg.duration.text, distance: leg.distance.text, price: `$${(basePrice * 1.2).toFixed(2)}` });

            setSearchResults(results);
            setTimeout(() => { mapRef.current?.fitToCoordinates(newMarkers, { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true }); }, 100);
        } catch (error) { setErrorMessage("An error occurred while searching."); console.error(error); }
        finally { setIsLoading(false); }
    }, [from, to, travelMode, departureTime]);

    const saveCurrentTrip = useCallback(() => { if (from && to) { addTrip({ name: `Trip to ${to.description.split(',')[0]}`, from: from.description, to: to.description }); speak(`Trip saved.`); } }, [from, to, addTrip]);
    const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => { setShowDatePicker(false); if (selectedDate) { setDepartureTime(selectedDate); } };
    const handleUseMyLocation = async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setErrorMessage('Permission to access location was denied'); return; }
        let location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;
        const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        const address = reverseGeocode[0];
        const description = `${address.name || ''} ${address.street || ''}, ${address.city || ''}, ${address.region || ''} ${address.postalCode || ''}`;
        const locationData = { description, location: { latitude, longitude } };
        setFrom(locationData); setFromText(description);
    }

    const styles = getStyles(darkMode);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            {showAccessibilityPage ? (
                <AccessibilityScreen
                    onBack={() => setShowAccessibilityPage(false)}
                    darkMode={darkMode}
                    setDarkMode={setDarkMode}
                />
            ) : (
                <>
                    <ProfileModal isVisible={profileModalVisible} onClose={() => setProfileModalVisible(false)} profile={detailedProfile} onSave={saveDetailedProfile} styles={styles} />
                    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                        <View style={styles.header}>
                            <Text style={styles.title}>AccessiRide</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TouchableOpacity onPress={() => setProfileModalVisible(true)} style={{ marginRight: 16 }}>
                                    <Text style={styles.editProfileText}>Edit Profile</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setDarkMode(!darkMode)}>
                                    {darkMode ? <Sun size={24} color="#E5E7EB" /> : <Moon size={24} color="#1F2937" />}
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.section}><Text style={styles.sectionTitle}>My Travel Needs</Text><View style={styles.iconGrid}><IconWrapper icon={Accessibility} label="Wheelchair" isSelected={preferences.wheelchair} onClick={() => togglePreference('wheelchair')} styles={styles} /><IconWrapper icon={Volume2} label="Audio Nav" isSelected={preferences.audioNav} onClick={() => togglePreference('audioNav')} styles={styles} /><IconWrapper icon={Annoyed} label="Low Sensory" isSelected={preferences.lowSensory} onClick={() => togglePreference('lowSensory')} styles={styles} /></View></View>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Travel Mode</Text>
                            <View style={styles.travelModeContainer}>
                                {TRAVEL_MODES.map(mode => (
                                    <TouchableOpacity key={mode} style={[styles.travelModeButton, travelMode === mode && styles.travelModeButtonSelected]} onPress={() => setTravelMode(mode)}>
                                        <Text style={[styles.travelModeText, travelMode === mode && styles.travelModeTextSelected]}>{mode.charAt(0) + mode.slice(1).toLowerCase()}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        {savedTrips.length > 0 && (<View style={styles.section}><Text style={styles.sectionTitle}>Saved Trips</Text>{savedTrips.map(trip => (<View key={trip.id} style={styles.savedTripCard}><TouchableOpacity style={{ flex: 1 }} onPress={() => { setFrom(null); setTo(null); setFromText(trip.from); setToText(trip.to); Keyboard.dismiss(); }}><Text style={styles.savedTripName}>{trip.name}</Text><Text style={styles.savedTripDetails}>{trip.from} → {trip.to}</Text></TouchableOpacity><TouchableOpacity onPress={() => removeTrip(trip.id)}><Trash2 size={20} color="#EF4444" /></TouchableOpacity></View>))}</View>)}
                        <View style={[styles.section, { zIndex: 10 }]}>
                            <Text style={styles.sectionTitle}>Plan a New Trip</Text>
                            <View style={styles.card}>
                                <Text style={styles.label}>From</Text>
                                <View style={styles.inputContainer}>
                                    <TextInput style={styles.textInput} placeholder="Start address" value={fromText} onChangeText={(text) => handleInputChange(text, 'from')} placeholderTextColor={styles.label.color} />
                                    <TouchableOpacity style={styles.micButton} onPress={handleUseMyLocation}><MapPin size={24} color={darkMode ? '#9CA3AF' : '#6B7280'} /></TouchableOpacity>
                                </View>
                                {fromSuggestions.length > 0 && (<FlatList data={fromSuggestions} keyExtractor={item => item.place_id} renderItem={({ item }) => (<TouchableOpacity style={styles.suggestionRow} onPress={() => onSuggestionPress(item, 'from')}><Text style={styles.suggestionText}>{item.description}</Text></TouchableOpacity>)} style={styles.suggestionsList} />)}
                                <View style={{ height: 16 }} />
                                <View style={styles.inputContainer}>
                                    <TextInput style={styles.textInput} placeholder="Destination address" value={toText} onChangeText={(text) => handleInputChange(text, 'to')} placeholderTextColor={styles.label.color} />
                                </View>
                                {toSuggestions.length > 0 && (<FlatList data={toSuggestions} keyExtractor={item => item.place_id} renderItem={({ item }) => (<TouchableOpacity style={styles.suggestionRow} onPress={() => onSuggestionPress(item, 'to')}><Text style={styles.suggestionText}>{item.description}</Text></TouchableOpacity>)} style={styles.suggestionsList} />)}

                                {travelMode === 'TRANSIT' && (
                                    <>
                                        <Text style={styles.label}>Departure Time (Optional)</Text>
                                        <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                                            <Text style={[styles.textInput, { paddingTop: 12 }]}>{departureTime.toLocaleString()}</Text>
                                        </TouchableOpacity>
                                        {showDatePicker && <DateTimePicker value={departureTime} mode="datetime" display="default" onChange={onDateChange} />}
                                    </>
                                )}
                                <View style={styles.buttonContainer}>
                                    <TouchableOpacity style={styles.mainButton} onPress={handleSearch} disabled={isLoading}>
                                        <Text style={styles.buttonText}>{isLoading ? 'Searching...' : 'Find a Ride'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.iconButton, styles.saveButton]} onPress={saveCurrentTrip}>
                                        <Save size={24} color="white" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <TouchableOpacity style={[styles.button, styles.accessibilityButton]} onPress={() => setShowAccessibilityPage(true)}>
                                <Text style={styles.buttonText}>Accessibility</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.section}>
                            <TouchableOpacity style={[styles.button, styles.reportButton]}>
                                <Text style={styles.buttonText}>Report an Issue</Text>
                            </TouchableOpacity>
                        </View>

                        {searched && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Search Results</Text>
                                {isLoading ? <ActivityIndicator size="large" color={styles.title.color} />
                                    : errorMessage ? <Text style={styles.bodyText}>{errorMessage}</Text>
                                        : searchResults.length === 0 ? <Text style={styles.bodyText}>No routes found.</Text>
                                            : (<>
                                                <AccessibilityMap markers={mapMarkers} mapRef={mapRef} styles={styles} />
                                                {directions.length > 0 && <DirectionsList steps={directions} styles={styles} />}
                                                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Transportation Options</Text>
                                                {searchResults.map(option => <ResultCard key={option.id} option={option} styles={styles} />)}
                                                <LocalCabs styles={styles} setAnnouncement={speak} />
                                            </>)}
                            </View>
                        )}
                    </ScrollView>
                </>
            )}
        </SafeAreaView>
    );
}

// --- STYLES ---
const getStyles = (darkMode: boolean) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: darkMode ? '#111827' : '#F9FAFB', },
    container: { paddingHorizontal: 16, },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, },
    editProfileText: { color: darkMode ? '#60A5FA' : '#2563EB', fontSize: 16, fontWeight: '600' },
    title: { fontSize: 32, fontWeight: 'bold', color: darkMode ? '#60A5FA' : '#2563EB', },
    section: { marginBottom: 24, },
    sectionTitle: { fontSize: 20, fontWeight: '600', marginBottom: 12, color: darkMode ? '#E5E7EB' : '#1F2937', },
    bodyText: { fontSize: 16, color: darkMode ? '#D1D5DB' : '#374151', paddingVertical: 8 },
    iconGrid: { flexDirection: 'row', justifyContent: 'space-around', },
    iconWrapperContainer: { alignItems: 'center', width: 90 },
    iconWrapperButton: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: darkMode ? '#374151' : '#E5E7EB', },
    iconWrapperButtonSelected: { backgroundColor: '#2563EB', },
    iconWrapperLabel: { marginTop: 8, fontWeight: '600', color: darkMode ? '#D1D5DB' : '#374151', textAlign: 'center' },
    card: { backgroundColor: darkMode ? '#1F2937' : '#FFFFFF', borderRadius: 16, padding: 16, },
    label: { fontSize: 16, fontWeight: '500', color: darkMode ? '#9CA3AF' : '#6B7280', marginBottom: 8, },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: darkMode ? '#374151' : '#F3F4F6', borderRadius: 12, borderWidth: 1, borderColor: darkMode ? '#4B5563' : '#D1D5DB', },
    textInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, fontSize: 16, color: darkMode ? '#F9FAFB' : '#111827', },
    micButton: { padding: 12, },
    button: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, },
    buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold', },
    accessibilityButton: {
        backgroundColor: '#16A34A',
    },
    reportButton: {
        backgroundColor: '#F59E0B',
    },
    resultCard: { backgroundColor: darkMode ? '#1F2937' : '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: darkMode ? '#374151' : '#E5E7EB' },
    resultCardProvider: { fontSize: 16, fontWeight: '600', color: darkMode ? '#D1D5DB' : '#374151', },
    resultCardDistance: { fontSize: 14, color: darkMode ? '#9CA3AF' : '#6B7280' },
    resultCardDuration: { fontSize: 20, fontWeight: 'bold', color: darkMode ? '#60A5FA' : '#2563EB', },
    resultCardPrice: { fontSize: 14, fontWeight: '600', color: darkMode ? '#D1D5DB' : '#374151', },
    savedTripCard: { backgroundColor: darkMode ? '#1F2937' : '#FFFFFF', borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, },
    savedTripName: { fontWeight: 'bold', color: darkMode ? '#60A5FA' : '#2563EB', },
    savedTripDetails: { fontSize: 12, color: darkMode ? '#9CA3AF' : '#6B7280', },
    suggestionsList: { borderWidth: 1, borderColor: darkMode ? '#4B5563' : '#D1D5DB', borderRadius: 12, backgroundColor: darkMode ? '#1F2937' : '#FFFFFF', marginTop: 8, maxHeight: 200 },
    suggestionRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: darkMode ? '#374151' : '#E5E7EB' },
    suggestionText: { color: darkMode ? '#F9FAFB' : '#111827', fontSize: 16, },
    mapContainer: { height: 250, borderRadius: 16, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: darkMode ? '#374151' : '#E5E7EB', },
    map: { ...StyleSheet.absoluteFillObject, },
    buttonContainer: { flexDirection: 'row', marginTop: 16, gap: 8, },
    mainButton: { flex: 1, backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 16, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
    iconButton: { width: 58, height: 58, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#16A34A', },
    saveButton: { backgroundColor: '#16A34A', },
    travelModeContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: darkMode ? '#374151' : '#E5E7EB', borderRadius: 12, padding: 4 },
    travelModeButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    travelModeButtonSelected: { backgroundColor: darkMode ? '#1F2937' : 'white' },
    travelModeText: { fontWeight: '600', color: darkMode ? '#D1D5DB' : '#374151' },
    travelModeTextSelected: { color: darkMode ? '#60A5FA' : '#2563EB' },
    directionStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    directionText: { flex: 1, fontSize: 16, color: darkMode ? '#D1D5DB' : '#374151', lineHeight: 22 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContainer: { width: '100%', backgroundColor: darkMode ? '#1F2937' : '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, },
    modalTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: darkMode ? '#E5E7EB' : '#1F2937', },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 },
    cabResult: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: darkMode ? '#374151' : '#E5E7EB' },
    cabName: { fontSize: 16, fontWeight: 'bold', color: darkMode ? '#E5E7EB' : '#1F2937' },
    cabDetails: { color: '#16A34A', fontWeight: '600' },
    cabButton: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#2563EB', borderRadius: 8 },
    cabButtonText: { color: 'white', fontWeight: 'bold' },
    cabCallbackButton: { padding: 8, backgroundColor: darkMode ? '#374151' : '#E5E7EB', borderRadius: 8 },
});

const getAccessibilityStyles = (darkMode: boolean) => {
    const dynamicStyles = {
        lightTeal: darkMode ? '#1C274C' : "#E6F6F3",
        lightGray: darkMode ? '#121826' : "#F5F5F7",
        textDark: darkMode ? '#E5E7EB' : '#1F2937',
        textLight: darkMode ? '#D1D5DB' : '#374151',
        cardBg: darkMode ? '#1E2433' : '#FFFFFF',
        inputBg: darkMode ? '#374151' : '#FFFFFF',
    };

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: darkMode ? '#121826' : BRAND_COLORS.white,
        },
        header: {
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            backgroundColor: BRAND_COLORS.white,
        },
        headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        headerBrandText: { color: BRAND_COLORS.navy, fontSize: 18, fontWeight: 'bold' },
        darkModeButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: BRAND_COLORS.navy, borderRadius: 6 },
        darkModeButtonText: { color: BRAND_COLORS.navy },
        backButton: { margin: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
        backButtonText: { color: BRAND_COLORS.teal, fontWeight: '600', fontSize: 16 },
        heroSection: { backgroundColor: dynamicStyles.lightTeal, paddingHorizontal: 16, paddingVertical: 48, alignItems: 'center' },
        heroTitle: { fontSize: 32, fontWeight: 'bold', color: BRAND_COLORS.navy, textAlign: 'center' },
        heroSubtitle: { marginTop: 16, fontSize: 18, color: dynamicStyles.textDark, textAlign: 'center' },
        section: { paddingVertical: 24, paddingHorizontal: 16 },
        sectionTitle: { fontSize: 22, fontWeight: '600', color: BRAND_COLORS.navy, textAlign: 'center' },
        featureGrid: { marginTop: 24, gap: 16 },
        featureCard: { backgroundColor: dynamicStyles.cardBg, padding: 24, borderRadius: 8, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2, }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, },
        featureCardTitle: { fontWeight: '600', fontSize: 18, marginBottom: 8, color: dynamicStyles.textDark },
        featureCardDesc: { fontSize: 14, opacity: 0.9, color: dynamicStyles.textLight, textAlign: 'center' },
        statementSection: { backgroundColor: dynamicStyles.lightGray, paddingVertical: 48, paddingHorizontal: 16, alignItems: 'center' },
        listItem: { fontSize: 18, marginVertical: 4, color: dynamicStyles.textDark },
        formContainer: { marginTop: 24, backgroundColor: dynamicStyles.cardBg, padding: 24, borderRadius: 8, gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2, }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
        textInput: { height: 48, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 12, backgroundColor: dynamicStyles.inputBg, fontSize: 16, color: dynamicStyles.textDark, },
        submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, backgroundColor: BRAND_COLORS.teal, borderRadius: 6 },
        submitButtonText: { color: BRAND_COLORS.white, fontWeight: 'bold', fontSize: 16 },
        bodyText: { color: dynamicStyles.textDark },
        phoneLink: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
        phoneLinkText: { color: BRAND_COLORS.teal, fontWeight: 'bold', fontSize: 18 },
        emergencyButton: { position: 'absolute', bottom: 24, right: 16, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 999, backgroundColor: BRAND_COLORS.yellow, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4, }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8, },
        emergencyButtonText: { color: '#000', fontWeight: 'bold' },
        footer: { marginTop: 32, paddingVertical: 24, backgroundColor: BRAND_COLORS.navy, alignItems: 'center' },
        footerText: { color: BRAND_COLORS.white, fontSize: 12 }
    });
};