import React, { useState, useEffect, useMemo } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, 
    StyleSheet, FlatList, ActivityIndicator, Alert, Linking, Modal, ScrollView
} from 'react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MapPin, Calendar, Clock, Edit2, Trash2, PlusCircle, Building2, Map as MapIcon, Info, X } from 'lucide-react-native';
import { PROVINCES, getDistrictsByProvince, getDefaultLocationSelection } from '../constants/locationData';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

const PAGE_SIZE = 10;
const NAME_PATTERN = /^[A-Za-z\s]+$/;
const TEXT_WITHOUT_SYMBOLS_PATTERN = /^[A-Za-z0-9\s]+$/;

// Normalizes "today" so date validation compares only calendar days.
const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
};

// Camps are limited to the next 7 calendar days.
const getMaxCampDate = () => {
    const maxDate = getToday();
    maxDate.setDate(maxDate.getDate() + 7);
    return maxDate;
};

// Stores the selected date in a backend-friendly YYYY-MM-DD format.
const formatDateKey = (value) => {
    const dateValue = new Date(value);
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const sanitizeName = (value) => value.replace(/[^A-Za-z\s]/g, '');
const sanitizePlainText = (value) => value.replace(/[^A-Za-z0-9\s]/g, '');
const toTimeKey = (value) => value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

// Accept only direct Google Maps place URLs for consistent deep-link behavior.
const isGoogleMapsPlaceLink = (value) => {
    if (!value) return true;
    return /^https?:\/\/([a-z0-9-]+\.)?google\.com\/maps\/place\//i.test(value.trim());
};

export default function CampMapScreen({ navigation }) {
    const { isAdmin } = useAuth();
    const defaults = getDefaultLocationSelection();
    
    const [camps, setCamps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [interestSubmitting, setInterestSubmitting] = useState(false);

    // Form states
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [name, setName] = useState('');
    const [province, setProvince] = useState(defaults.province);
    const [district, setDistrict] = useState(defaults.district);
    const [nearestHospital, setNearestHospital] = useState('');
    const [location, setLocation] = useState('');
    const [address, setAddress] = useState('');
    const [googleMapLink, setGoogleMapLink] = useState('');
    const [date, setDate] = useState(new Date());
    const [startTime, setStartTime] = useState(new Date());
    const [endTime, setEndTime] = useState(new Date());
    const [campStatus, setCampStatus] = useState('UPCOMING');
    const [saving, setSaving] = useState(false);

    // Modal view states
    const [selectedCamp, setSelectedCamp] = useState(null);
    const [hospitals, setHospitals] = useState([]);

    // DateTimePicker visibility
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);

    // District choices depend on the currently selected province.
    const districts = useMemo(() => getDistrictsByProvince(province), [province]);

    useEffect(() => {
        if (!province || !district) { setHospitals([]); return; }
        api.get('/api/hospitals', { params: { province, district } })
            .then(res => {
                const list = (res.data || []).map(item => item.name);
                setHospitals(list);
                if (!list.includes(nearestHospital)) {
                    setNearestHospital(list[0] || '');
                }
            })
            .catch(err => { 
                console.error('Error loading hospitals', err); 
                setHospitals([]); 
                setNearestHospital(''); 
            });
    }, [province, district]);

    // Loads the current camp list used by both the map cards and detail modal.
    const fetchCamps = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/camps');
            setCamps(res.data || []);
        } catch (err) {
            console.error('Error fetching camps', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCamps();
    }, []);

    // Clears form state after saving or when the admin closes the modal.
    const resetForm = () => {
        setName('');
        setProvince(defaults.province);
        setDistrict(defaults.district);
        setNearestHospital('');
        setLocation('');
        setAddress('');
        setGoogleMapLink('');
        setDate(new Date());
        setStartTime(new Date());
        setEndTime(new Date());
        setCampStatus('UPCOMING');
        setEditingId(null);
        setShowForm(false);
    };

    // Validates user input and then creates or updates a camp record.
    const handleSaveCamp = async () => {
        if (!name || !location || !date) {
            return Alert.alert('Missing Info', 'Please provide camp name, location and date.');
        }
        if (!NAME_PATTERN.test(name.trim())) {
            return Alert.alert('Invalid Camp Name', 'Camp name can contain only letters and spaces.');
        }
        if (!TEXT_WITHOUT_SYMBOLS_PATTERN.test(location.trim())) {
            return Alert.alert('Invalid Location', 'Location can contain only letters, numbers, and spaces.');
        }
        if (address && !TEXT_WITHOUT_SYMBOLS_PATTERN.test(address.trim())) {
            return Alert.alert('Invalid Address', 'Address can contain only letters, numbers, and spaces.');
        }
        if (!isGoogleMapsPlaceLink(googleMapLink.trim())) {
            return Alert.alert('Invalid Google Maps Link', 'Please enter a Google Maps place link.');
        }
        if (date < getToday() || date > getMaxCampDate()) {
            return Alert.alert('Invalid Date', 'Camp date must be within the next 7 days.');
        }
        if (toTimeKey(startTime) >= toTimeKey(endTime)) {
            return Alert.alert('Invalid Time', 'Start time must be before end time.');
        }

        setSaving(true);
        const payload = {
            name: name.trim(),
            province,
            district,
            nearestHospital,
            location: location.trim(),
            address: address.trim(),
            googleMapLink: googleMapLink.trim(),
            date: formatDateKey(date),
            startTime: toTimeKey(startTime),
            endTime: toTimeKey(endTime),
            campStatus
        };

        try {
            if (editingId) {
                await api.put(`/api/camps/${editingId}`, payload);
                Alert.alert('Success', 'Camp details updated.');
            } else {
                await api.post('/api/camps/create', payload);
                Alert.alert('Success', 'New donation camp created.');
            }
            resetForm();
            fetchCamps();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Unable to save camp.');
        } finally {
            setSaving(false);
        }
    };

    // Pre-fills the admin form from an existing camp before editing.
    const openEdit = (camp) => {
        setEditingId(camp.id || camp._id);
        setName(camp.name || '');
        setProvince(camp.province || defaults.province);
        setDistrict(camp.district || defaults.district);
        setNearestHospital(camp.nearestHospital || '');
        setLocation(camp.location || '');
        setAddress(camp.address || '');
        setGoogleMapLink(camp.googleMapLink || '');
        
        if (camp.date) setDate(new Date(camp.date));
        
        if (camp.startTime) {
            const [h, m] = camp.startTime.split(':');
            const d = new Date();
            d.setHours(parseInt(h), parseInt(m));
            setStartTime(d);
        }
        
        if (camp.endTime) {
            const [h, m] = camp.endTime.split(':');
            const d = new Date();
            d.setHours(parseInt(h), parseInt(m));
            setEndTime(d);
        }
        
        setCampStatus(camp.campStatus || 'UPCOMING');
        setSelectedCamp(null);
        setShowForm(true);
    };

    // Confirms before permanently removing a camp.
    const handleDeleteCamp = (campId) => {
        Alert.alert('Delete camp?', 'This donation camp event will be permanently removed.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                    await api.delete(`/api/camps/${campId}`);
                    fetchCamps();
                } catch (error) {
                    Alert.alert('Error', 'Failed to delete camp.');
                }
            }}
        ]);
    };

    // Lets a donor register interest from the camp detail modal.
    const handleInterest = async (campId) => {
        if (interestSubmitting) return;
        setInterestSubmitting(true);
        try {
            const res = await api.post(`/api/camps/${campId}/interest`);
            setCamps(prev => prev.map(c => (c.id === campId ? res.data : c)));
            Alert.alert('Success', 'You have registered your interest. You will be notified about this camp!');
        } catch (error) { 
            Alert.alert('Error', 'Unable to register interest.');
        } finally {
            setInterestSubmitting(false);
        }
    };

    // Keeps camps ordered chronologically regardless of the API response order.
    const sortedCamps = useMemo(() => {
        return [...camps].sort((a, b) => {
            const aDate = new Date(`${a.date}T${a.startTime || a.time || '00:00'}`).getTime();
            const bDate = new Date(`${b.date}T${b.startTime || b.time || '00:00'}`).getTime();
            return aDate - bDate;
        });
    }, [camps]);

    // Filters the camp list by the user's search text across key location fields.
    const filteredCamps = useMemo(() => {
        if (!searchText) return sortedCamps;
        const s = searchText.toLowerCase();
        return sortedCamps.filter(c =>
            (c.name || '').toLowerCase().includes(s) ||
            (c.location || '').toLowerCase().includes(s) ||
            (c.district || '').toLowerCase().includes(s) ||
            (c.province || '').toLowerCase().includes(s)
        );
    }, [sortedCamps, searchText]);

    // Maps camp status values to their card badge colors.
    const getStatusStyles = (status) => {
        if (status === 'ONGOING') return { bg: '#DCFCE7', text: '#166534' };
        if (status === 'ENDED')   return { bg: '#F3F4F6', text: '#374151' };
        return { bg: '#FEE2E2', text: '#9F1239' };
    };

    // Renders one camp card inside the main listing.
    const renderCampItem = ({ item: camp }) => {
        const sStyles = getStatusStyles(camp.campStatus);
        
        return (
            <View style={styles.card}>
                <View style={[styles.cardHeader, { backgroundColor: sStyles.bg }]}>
                    <Text style={[styles.statusText, { color: sStyles.text }]}>
                        {camp.campStatus || 'UPCOMING'}
                    </Text>
                </View>

                <View style={styles.cardBody}>
                    <Text style={styles.campName}>{camp.name}</Text>
                    
                    <View style={styles.infoRow}>
                        <MapPin size={16} color="#64748B" />
                        <Text style={styles.infoText} numberOfLines={1}>{camp.location} ({camp.district})</Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                        <Calendar size={16} color="#64748B" />
                        <Text style={styles.infoText}>{new Date(camp.date).toLocaleDateString()}</Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                        <Clock size={16} color="#64748B" />
                        <Text style={styles.infoText}>{camp.startTime || camp.time || 'TBD'} - {camp.endTime || 'TBD'}</Text>
                    </View>

                    {isAdmin ? (
                        <View style={styles.adminRow}>
                            <Text style={styles.interestText}>Interested: {camp.interestCount || 0}</Text>
                            <View style={styles.actionIcons}>
                                <TouchableOpacity onPress={() => openEdit(camp)} style={styles.iconBtn}>
                                    <Edit2 size={18} color="#2563EB" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteCamp(camp.id)} style={styles.iconBtn}>
                                    <Trash2 size={18} color="#DC2626" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : null}

                    <View style={styles.cardFooter}>
                        <TouchableOpacity 
                            style={styles.detailsBtn} 
                            onPress={() => setSelectedCamp(camp)}
                        >
                            <Text style={styles.detailsBtnText}>View Details</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.title}>Donation Camps</Text>
                        <Text style={styles.subtitle}>Find an event near you</Text>
                    </View>
                    {isAdmin && (
                        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
                            <PlusCircle size={20} color="#FFFFFF" />
                            <Text style={styles.addBtnText}>Add New</Text>
                        </TouchableOpacity>
                    )}
                </View>
                
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search name, location, district..."
                    value={searchText}
                    onChangeText={setSearchText}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#E11D48" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={filteredCamps}
                    keyExtractor={item => String(item.id)}
                    renderItem={renderCampItem}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No camps match your search.</Text>
                    }
                />
            )}

            {/* CREATE / EDIT MODAL */}
            <Modal visible={showForm} animationType="slide" transparent={true} onRequestClose={resetForm}>
                <View style={styles.modalOverlay}>
                    <View style={styles.formContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingId ? 'Edit Camp' : 'Add New Camp'}</Text>
                            <TouchableOpacity onPress={resetForm}>
                                <X size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.formScroll}>
                            <Text style={styles.label}>Camp Name *</Text>
                            <TextInput style={styles.input} value={name} onChangeText={(value) => setName(sanitizeName(value))} placeholder="Enter camp name" />

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={styles.label}>Province</Text>
                                    <View style={styles.pickerContainer}>
                                        <Picker
                                            style={styles.picker}
                                            selectedValue={province}
                                            dropdownIconColor="#475569"
                                            mode="dropdown"
                                            onValueChange={(value) => {
                                                setProvince(value);
                                                const nextDistricts = getDistrictsByProvince(value);
                                                setDistrict(nextDistricts[0] || '');
                                            }}
                                        >
                                            {PROVINCES.map(p => <Picker.Item key={p} label={p} value={p} />)}
                                        </Picker>
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>District</Text>
                                    <View style={styles.pickerContainer}>
                                        <Picker
                                            style={styles.picker}
                                            selectedValue={district}
                                            dropdownIconColor="#475569"
                                            mode="dropdown"
                                            onValueChange={setDistrict}
                                        >
                                            {districts.map(d => <Picker.Item key={d} label={d} value={d} />)}
                                        </Picker>
                                    </View>
                                </View>
                            </View>

                            <Text style={styles.label}>Nearest Hospital</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    style={styles.picker}
                                    selectedValue={nearestHospital}
                                    dropdownIconColor="#475569"
                                    mode="dropdown"
                                    onValueChange={setNearestHospital}
                                >
                                    {hospitals.length === 0 && <Picker.Item label="No hospitals available" value="" />}
                                    {hospitals.map(h => <Picker.Item key={h} label={h} value={h} />)}
                                </Picker>
                            </View>

                            <Text style={styles.label}>Location / Venue *</Text>
                            <TextInput style={styles.input} value={location} onChangeText={(value) => setLocation(sanitizePlainText(value))} placeholder="Venue name" />

                            <Text style={styles.label}>Address</Text>
                            <TextInput style={styles.input} value={address} onChangeText={(value) => setAddress(sanitizePlainText(value))} placeholder="Detailed address" multiline numberOfLines={2} />

                            <Text style={styles.label}>Google Maps Link</Text>
                            <TextInput style={styles.input} value={googleMapLink} onChangeText={setGoogleMapLink} placeholder="https://maps.google.com/..." />

                            <Text style={styles.label}>Camp Status</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    style={styles.picker}
                                    selectedValue={campStatus}
                                    dropdownIconColor="#475569"
                                    mode="dropdown"
                                    onValueChange={setCampStatus}
                                >
                                    <Picker.Item label="UPCOMING" value="UPCOMING" />
                                    <Picker.Item label="ONGOING" value="ONGOING" />
                                    <Picker.Item label="ENDED" value="ENDED" />
                                </Picker>
                            </View>

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={styles.label}>Date *</Text>
                                    <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                                        <Calendar size={18} color="#64748B" />
                                        <Text style={styles.datePickerText}>{date.toLocaleDateString()}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={styles.label}>Start Time</Text>
                                    <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowStartTimePicker(true)}>
                                        <Clock size={18} color="#64748B" />
                                        <Text style={styles.datePickerText}>
                                            {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>End Time</Text>
                                    <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowEndTimePicker(true)}>
                                        <Clock size={18} color="#64748B" />
                                        <Text style={styles.datePickerText}>
                                            {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={date}
                                    mode="date"
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(false);
                                        if (selectedDate) setDate(selectedDate);
                                    }}
                                    minimumDate={getToday()}
                                    maximumDate={getMaxCampDate()}
                                />
                            )}
                            {showStartTimePicker && (
                                <DateTimePicker
                                    value={startTime}
                                    mode="time"
                                    onChange={(event, selectedTime) => {
                                        setShowStartTimePicker(false);
                                        if (selectedTime) setStartTime(selectedTime);
                                    }}
                                />
                            )}
                            {showEndTimePicker && (
                                <DateTimePicker
                                    value={endTime}
                                    mode="time"
                                    onChange={(event, selectedTime) => {
                                        setShowEndTimePicker(false);
                                        if (selectedTime) setEndTime(selectedTime);
                                    }}
                                />
                            )}
                        </ScrollView>

                        <View style={styles.formFooter}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.saveBtn, saving && { opacity: 0.7 }]} 
                                onPress={handleSaveCamp}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.saveBtnText}>{editingId ? 'Update Camp' : 'Create Camp'}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* DETAILS MODAL */}
            <Modal visible={!!selectedCamp} animationType="fade" transparent={true} onRequestClose={() => setSelectedCamp(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.detailsContainer}>
                        {selectedCamp && (
                            <>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle} numberOfLines={2}>{selectedCamp.name}</Text>
                                    <TouchableOpacity onPress={() => setSelectedCamp(null)}>
                                        <X size={24} color="#64748B" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={{ maxHeight: 400 }}>
                                    <View style={styles.detailItem}>
                                        <MapPin size={20} color="#E11D48" />
                                        <View style={styles.detailTextCol}>
                                            <Text style={styles.detailLabel}>Location</Text>
                                            <Text style={styles.detailValue}>{selectedCamp.location}</Text>
                                            <Text style={styles.detailSubValue}>{selectedCamp.district}, {selectedCamp.province}</Text>
                                        </View>
                                    </View>

                                    {selectedCamp.address ? (
                                        <View style={styles.detailItem}>
                                            <MapIcon size={20} color="#E11D48" />
                                            <View style={styles.detailTextCol}>
                                                <Text style={styles.detailLabel}>Address</Text>
                                                <Text style={styles.detailValue}>{selectedCamp.address}</Text>
                                            </View>
                                        </View>
                                    ) : null}

                                    <View style={styles.detailItem}>
                                        <Calendar size={20} color="#E11D48" />
                                        <View style={styles.detailTextCol}>
                                            <Text style={styles.detailLabel}>Date</Text>
                                            <Text style={styles.detailValue}>{new Date(selectedCamp.date).toLocaleDateString()}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.detailItem}>
                                        <Clock size={20} color="#E11D48" />
                                        <View style={styles.detailTextCol}>
                                            <Text style={styles.detailLabel}>Time</Text>
                                            <Text style={styles.detailValue}>
                                                {selectedCamp.startTime || selectedCamp.time || 'TBD'} - {selectedCamp.endTime || 'TBD'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.detailItem}>
                                        <Building2 size={20} color="#E11D48" />
                                        <View style={styles.detailTextCol}>
                                            <Text style={styles.detailLabel}>Nearest Hospital</Text>
                                            <Text style={styles.detailValue}>{selectedCamp.nearestHospital || 'N/A'}</Text>
                                        </View>
                                    </View>

                                    {isAdmin && (
                                        <View style={styles.detailItem}>
                                            <Info size={20} color="#E11D48" />
                                            <View style={styles.detailTextCol}>
                                                <Text style={styles.detailLabel}>Engagement</Text>
                                                <Text style={styles.detailValue}>{selectedCamp.interestCount || 0} People Interested</Text>
                                            </View>
                                        </View>
                                    )}

                                    {selectedCamp.googleMapLink ? (
                                        <TouchableOpacity 
                                            style={styles.mapLinkAction} 
                                            onPress={() => Linking.openURL(selectedCamp.googleMapLink)}
                                        >
                                            <MapIcon size={18} color="#2563EB" />
                                            <Text style={styles.mapLinkActionText}>Open in Google Maps</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </ScrollView>

                                <View style={styles.detailsFooter}>
                                    {!isAdmin ? (
                                        <TouchableOpacity 
                                            style={[styles.interestActionBtn, interestSubmitting && { opacity: 0.7 }]} 
                                            onPress={() => handleInterest(selectedCamp.id)}
                                            disabled={interestSubmitting}
                                        >
                                            <Text style={styles.interestActionBtnText}>
                                                {interestSubmitting ? 'Submitting...' : "I'm Interested"}
                                            </Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={styles.adminActionRow}>
                                            <TouchableOpacity 
                                                style={styles.adminEditBtn} 
                                                onPress={() => openEdit(selectedCamp)}
                                            >
                                                <Text style={styles.adminEditBtnText}>Edit Camp</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                style={styles.adminDelBtn} 
                                                onPress={() => {
                                                    const id = selectedCamp.id;
                                                    setSelectedCamp(null);
                                                    handleDeleteCamp(id);
                                                }}
                                            >
                                                <Text style={styles.adminDelBtnText}>Delete</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                    <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedCamp(null)}>
                                        <Text style={styles.closeBtnText}>Close</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F4FF',
    },
    header: {
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    subtitle: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 16,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    addBtn: {
        backgroundColor: '#E11D48',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    addBtnText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        marginLeft: 6,
        fontSize: 14,
    },
    searchInput: {
        marginTop: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        color: '#1E293B'
    },
    listContainer: {
        padding: 20,
    },
    emptyText: {
        textAlign: 'center',
        color: '#64748B',
        marginTop: 40,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    cardHeader: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        alignItems: 'flex-start',
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    cardBody: {
        padding: 16,
    },
    campName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#475569',
        flex: 1,
    },
    adminRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 12,
    },
    interestText: {
        fontSize: 13,
        color: '#E11D48',
        fontWeight: '600',
    },
    actionIcons: {
        flexDirection: 'row',
    },
    iconBtn: {
        padding: 6,
        marginLeft: 8,
    },
    cardFooter: {
        flexDirection: 'row',
        marginTop: 16,
    },
    detailsBtn: {
        flex: 1,
        backgroundColor: '#FFF1F2',
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailsBtnText: {
        color: '#E11D48',
        fontWeight: 'bold',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    formContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        maxHeight: '90%',
        padding: 20,
        elevation: 5,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E293B',
        flex: 1,
        marginRight: 10,
    },
    formScroll: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 6,
        marginTop: 12,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        color: '#1E293B',
    },
    pickerContainer: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        overflow: 'hidden',
    },
    picker: {
        height: 54,
        color: '#1E293B',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    datePickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        padding: 10,
    },
    datePickerText: {
        marginLeft: 8,
        color: '#1E293B',
        fontSize: 14,
    },
    formFooter: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelBtn: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
    },
    cancelBtnText: {
        color: '#64748B',
        fontWeight: '600',
    },
    saveBtn: {
        flex: 2,
        backgroundColor: '#E11D48',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtnText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    // Details Modal Styles
    detailsContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        elevation: 5,
    },
    detailItem: {
        flexDirection: 'row',
        marginBottom: 20,
        alignItems: 'flex-start',
    },
    detailTextCol: {
        marginLeft: 16,
        flex: 1,
    },
    detailLabel: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 16,
        color: '#1E293B',
        fontWeight: '600',
    },
    detailSubValue: {
        fontSize: 14,
        color: '#64748B',
    },
    mapLinkAction: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        padding: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 10,
    },
    mapLinkActionText: {
        marginLeft: 10,
        color: '#2563EB',
        fontWeight: 'bold',
    },
    detailsFooter: {
        marginTop: 24,
    },
    interestActionBtn: {
        backgroundColor: '#E11D48',
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    interestActionBtnText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    adminActionRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    adminEditBtn: {
        flex: 1,
        backgroundColor: '#DBEAFE',
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    adminEditBtnText: {
        color: '#1D4ED8',
        fontWeight: 'bold',
    },
    adminDelBtn: {
        flex: 1,
        backgroundColor: '#FEE2E2',
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    adminDelBtnText: {
        color: '#B91C1C',
        fontWeight: 'bold',
    },
    closeBtn: {
        padding: 12,
        alignItems: 'center',
    },
    closeBtnText: {
        color: '#64748B',
        fontWeight: '600',
    }
});
