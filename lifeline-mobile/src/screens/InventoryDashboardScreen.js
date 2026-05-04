import React, { useState, useEffect, useMemo } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, ScrollView, 
    StyleSheet, ActivityIndicator, Alert 
} from 'react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, AlertTriangle, CheckCircle, Flame, Package, Activity, Clock, Search } from 'lucide-react-native';

const PAGE_SIZE = 10;

export default function InventoryDashboardScreen({ navigation }) {
    const { isAdmin, canDispatchEmergency, canDispatchHospitalRequest } = useAuth();

    const [inventory, setInventory] = useState([]);
    const [emergencyRequests, setEmergencyRequests] = useState([]);
    const [hospitalRequests, setHospitalRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [activeSection, setActiveSection] = useState('emergency');
    const [sendingForRequest, setSendingForRequest] = useState({});
    const [dispatchLoading, setDispatchLoading] = useState(null);

    // Filter states
    const [emergSearch, setEmergSearch] = useState('');
    const [normSearch, setNormSearch] = useState('');
    const [invSearch, setInvSearch] = useState('');
    const [fulfSearch, setFulfSearch] = useState('');
    
    // Pagination
    const [emergPage, setEmergPage] = useState(1);
    const [normPage, setNormPage] = useState(1);
    const [invPage, setInvPage] = useState(1);
    const [fulfPage, setFulfPage] = useState(1);

    // Pills Filter
    const [safeFilter, setSafeFilter] = useState('ALL'); // ALL, SAFE, PENDING, BIO-HAZARD
    const [btFilter, setBtFilter] = useState('ALL'); 

    const fetchData = async () => {
        setLoading(true);
        try {
            const [invRes, emgRes, hospRes] = await Promise.all([
                api.get('/api/inventory'),
                api.get('/api/emergency/requests/all'),
                api.get('/api/hospital-requests')
            ]);
            
            setInventory((invRes.data || []).map(i => ({ ...i, id: i.id || i._id })));
            
            const eReq = (emgRes.data || []).map(r => ({ ...r, requestType: 'emergency', id: r.id || r._id }));
            const hReq = (hospRes.data || []).map(r => ({ ...r, requestType: 'hospital', id: r.id || r._id }));
            
            setEmergencyRequests(eReq);
            setHospitalRequests(hReq);
            
            const newSending = {};
            [...eReq, ...hReq].forEach(r => {
                const status = (r.status || '').toUpperCase();
                if (status !== 'FULFILLED') {
                    const rem = Math.max(0, (r.unitsRequested || r.units || 0) - (r.unitsFulfilled || 0));
                    newSending[r.id] = String(Math.max(1, rem));
                }
            });
            setSendingForRequest(prev => ({...prev, ...newSending}));
            
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSendRequest = async (req, type) => {
        const units = parseInt(sendingForRequest[req.id] || '0', 10);
        if (!units || units <= 0) return Alert.alert('Error', 'Invalid units');

        setDispatchLoading(req.id);
        const url = type === 'hospital' 
            ? `/api/hospital-requests/${req.id}/fulfill` 
            : `/api/emergency/requests/${req.id}/fulfill`;
            
        try {
            await api.put(url, { units });
            Alert.alert('Success', 'Blood units dispatched.');
            setSendingForRequest(prev => ({ ...prev, [req.id]: '' })); // Reset units after success
            fetchData();
        } catch (error) {
            let msg = 'Unable to complete dispatch.';
            if (error?.response?.data) {
                msg = typeof error.response.data === 'string' 
                    ? error.response.data 
                    : error.response.data.message || 'Not enough safe blood units in the system.';
            } else if (error?.message) {
                msg = error.message;
            }
            Alert.alert('Dispatch Failed', msg);
        } finally {
            setDispatchLoading(null);
        }
    };

    // --- Analytics Computation ---
    const bloodAnalytics = useMemo(() => {
        const types = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
        const data = types.reduce((acc, t) => ({...acc, [t]: 0}), {});
        
        const expiryLimit = new Date();
        expiryLimit.setDate(expiryLimit.getDate() - 42);

        inventory.forEach(item => {
            const status = String(item.status || '').toUpperCase();
            const safety = String(item.safetyFlag || '').toUpperCase();
            const colDate = item.collectedAt ? new Date(item.collectedAt) : null;
            
            const isUsable = safety === 'SAFE' || status === 'SAFE' || status === 'AVAILABLE';
            const isNotExpired = !colDate || colDate >= expiryLimit;

            if (isUsable && isNotExpired && item.bloodType) {
                if (data[item.bloodType] !== undefined) {
                    data[item.bloodType] += Number(item.quantity || 0);
                }
            }
        });
        
        return Object.entries(data).sort().map(([bt, units]) => ({ bt, units }));
    }, [inventory]);

    const getAnalyticsColor = (units) => {
        if (units <= 5)  return { bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B', label: 'Critical', Icon: AlertCircle };
        if (units <= 20) return { bg: '#FEF9C3', border: '#FDE68A', text: '#92400E', label: 'Medium', Icon: AlertTriangle };
        return              { bg: '#DCFCE7', border: '#6EE7B7', text: '#065F46', label: 'Sufficient', Icon: CheckCircle };
    };

    // --- Filtering Logic ---
    const matchesReq = (r, q) => {
        if (!q) return true;
        const s = q.toLowerCase();
        return String(r.id).includes(s) || (r.hospital || '').toLowerCase().includes(s) || (r.bloodType || '').toLowerCase().includes(s);
    };

    const emergencyActive = emergencyRequests.filter(r => (r.urgency || '').toUpperCase() === 'CRITICAL' && r.status !== 'FULFILLED' && matchesReq(r, emergSearch));
    const normalActive = [...hospitalRequests, ...emergencyRequests].filter(r => (r.urgency || '').toUpperCase() !== 'CRITICAL' && r.status !== 'FULFILLED' && matchesReq(r, normSearch));
    
    // Fulfilled requests compilation
    const fulfilledActive = [...hospitalRequests, ...emergencyRequests].filter(r => r.status === 'FULFILLED' && matchesReq(r, fulfSearch));

    const inventoryActive = inventory.filter(bag => {
        if (safeFilter !== 'ALL' && (bag.safetyFlag || 'PENDING').toUpperCase() !== safeFilter) return false;
        if (btFilter !== 'ALL' && bag.bloodType !== btFilter) return false;
        if (invSearch) {
            const s = invSearch.toLowerCase();
            if (!String(bag.id).includes(s) && !(bag.donorName || '').toLowerCase().includes(s)) return false;
        }
        return true;
    });

    const renderCard = (req, canSend, reqType) => {
        const reqUnits = req.unitsRequested || req.units || 0;
        const remaining = Math.max(0, reqUnits - (req.unitsFulfilled || 0));
        const isEmergency = (req.urgency || req.priority || '').toUpperCase() === 'CRITICAL';
        const isFulfilled = req.status === 'FULFILLED';

        return (
            <View key={req.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>#{req.id} • {req.hospital}</Text>
                    <View style={[styles.badge, isFulfilled ? {backgroundColor: '#DCFCE7'} : (isEmergency ? styles.badgeCrit : styles.badgeNorm)]}>
                        <Text style={[styles.badgeText, { color: isFulfilled ? '#166534' : (isEmergency ? '#DC2626' : '#2563EB') }]}>
                            {req.bloodType} • {isFulfilled ? 'FULFILLED' : (isEmergency ? 'EMERGENCY' : 'NORMAL')}
                        </Text>
                    </View>
                </View>
                <Text style={styles.cardBodyText}>
                    Units: {reqUnits} | Fulfilled: {req.unitsFulfilled || 0}
                </Text>
                {!!(req.reason || req.priority_reason) && (
                    <Text style={styles.reasonText}>Reason: {req.reason || req.priority_reason}</Text>
                )}

                {!isFulfilled && canSend ? (
                    <View style={styles.dispatchRow}>
                        <TextInput
                            style={styles.dispatchInput}
                            keyboardType="numeric"
                            value={sendingForRequest[req.id]}
                            onChangeText={t => setSendingForRequest(p => ({ ...p, [req.id]: t }))}
                        />
                        <TouchableOpacity style={styles.dispatchBtn} onPress={() => handleSendRequest(req, reqType)} disabled={dispatchLoading === req.id}>
                            <Text style={styles.dispatchBtnText}>{dispatchLoading === req.id ? 'Sending...' : 'Dispatch'}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    !isFulfilled && <Text style={styles.warningText}>Admin rights required to dispatch.</Text>
                )}
            </View>
        );
    };

    if (!isAdmin && !canDispatchEmergency && !canDispatchHospitalRequest) {
        return (
            <View style={styles.centerContainer}>
                <Package size={48} color="#DC2626" />
                <Text style={styles.unauthText}>Access Restricted</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={{marginTop: 20}}>
                    <Text style={{color: '#E11D48', fontWeight: 'bold'}}>Return to Home</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('AdminDashboard')}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.pageTitle}>Inventory Management</Text>
            </View>

            <View style={styles.segmentControl}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity style={[styles.segmentBtn, activeSection === 'emergency' && styles.segActive]} onPress={() => setActiveSection('emergency')}>
                        <Text style={activeSection === 'emergency' ? styles.segTextActive : styles.segText}>Emergency ({emergencyActive.length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.segmentBtn, activeSection === 'normal' && styles.segActive]} onPress={() => setActiveSection('normal')}>
                        <Text style={activeSection === 'normal' ? styles.segTextActive : styles.segText}>Normal ({normalActive.length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.segmentBtn, activeSection === 'fulfilled' && styles.segActive]} onPress={() => setActiveSection('fulfilled')}>
                        <Text style={activeSection === 'fulfilled' ? styles.segTextActive : styles.segText}>Fulfilled ({fulfilledActive.length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.segmentBtn, activeSection === 'inventory' && styles.segActive]} onPress={() => setActiveSection('inventory')}>
                        <Text style={activeSection === 'inventory' ? styles.segTextActive : styles.segText}>All Stock ({inventoryActive.length})</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#E11D48" style={{ marginTop: 40 }} />
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    
                    {/* Analytics Render (Admin Only) */}
                    {isAdmin && activeSection === 'inventory' && (
                        <View style={styles.analyticsBox}>
                            <Text style={styles.sectionHeader}>Safe Inventory Analytics</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 10}}>
                                {bloodAnalytics.map(analytic => {
                                    const col = getAnalyticsColor(analytic.units);
                                    const Icon = col.Icon;
                                    return (
                                        <View key={analytic.bt} style={[styles.analyticCard, { backgroundColor: col.bg, borderColor: col.border }]}>
                                            <Text style={[styles.aBt, { color: col.text }]}>{analytic.bt}</Text>
                                            <Text style={[styles.aUnits, { color: col.text }]}>{analytic.units} units</Text>
                                            <View style={styles.aLabelRow}>
                                                <Icon size={12} color={col.text}/>
                                                <Text style={[styles.aLabel, { color: col.text }]}>{col.label}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* Section Renders */}
                    {activeSection === 'emergency' && (
                        <View>
                            <View style={styles.searchWrap}>
                                <Search size={16} color="#94A3B8" />
                                <TextInput style={styles.searchInp} placeholder="Search emergency..." value={emergSearch} onChangeText={t => {setEmergSearch(t); setEmergPage(1)}} />
                            </View>
                            {emergencyActive.slice(0, emergPage * PAGE_SIZE).map(req => renderCard(req, canDispatchEmergency, 'emergency'))}
                            {emergencyActive.length === 0 && <Text style={styles.emptyText}>No emergency requests found.</Text>}
                            {emergPage * PAGE_SIZE < emergencyActive.length && (
                                <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setEmergPage(p => p+1)}>
                                    <Text style={styles.loadMoreText}>Show More ({emergencyActive.length - emergPage * PAGE_SIZE} left)</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                    
                    {activeSection === 'normal' && (
                        <View>
                            <View style={styles.searchWrap}>
                                <Search size={16} color="#94A3B8" />
                                <TextInput style={styles.searchInp} placeholder="Search normal..." value={normSearch} onChangeText={t => {setNormSearch(t); setNormPage(1)}} />
                            </View>
                            {normalActive.slice(0, normPage * PAGE_SIZE).map(req => renderCard(req, canDispatchHospitalRequest, req.requestType || 'hospital'))}
                            {normalActive.length === 0 && <Text style={styles.emptyText}>No normal requests found.</Text>}
                            {normPage * PAGE_SIZE < normalActive.length && (
                                <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setNormPage(p => p+1)}>
                                    <Text style={styles.loadMoreText}>Show More</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {activeSection === 'fulfilled' && (
                        <View>
                            <View style={styles.searchWrap}>
                                <Search size={16} color="#94A3B8" />
                                <TextInput style={styles.searchInp} placeholder="Search fulfilled..." value={fulfSearch} onChangeText={t => {setFulfSearch(t); setFulfPage(1)}} />
                            </View>
                            {fulfilledActive.slice(0, fulfPage * PAGE_SIZE).map(req => renderCard(req, false, ''))}
                            {fulfilledActive.length === 0 && <Text style={styles.emptyText}>No fulfilled requests yet.</Text>}
                            {fulfPage * PAGE_SIZE < fulfilledActive.length && (
                                <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setFulfPage(p => p+1)}>
                                    <Text style={styles.loadMoreText}>Show More</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {activeSection === 'inventory' && (
                        <View>
                            <View style={styles.searchWrap}>
                                <Search size={16} color="#94A3B8" />
                                <TextInput style={styles.searchInp} placeholder="Search ID or Donor..." value={invSearch} onChangeText={t => {setInvSearch(t); setInvPage(1)}} />
                            </View>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10}}>
                                {['ALL', 'SAFE', 'PENDING', 'BIO-HAZARD'].map(s => (
                                    <TouchableOpacity key={s} onPress={() => {setSafeFilter(s); setInvPage(1)}} style={[styles.filterPill, safeFilter === s && styles.filterPillActive]}>
                                        <Text style={[styles.filterText, safeFilter === s && styles.filterTextActive]}>{s}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 16}}>
                                {['ALL', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(b => (
                                    <TouchableOpacity key={b} onPress={() => {setBtFilter(b); setInvPage(1)}} style={[styles.filterPill, btFilter === b && styles.filterPillActive]}>
                                        <Text style={[styles.filterText, btFilter === b && styles.filterTextActive]}>{b}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {inventoryActive.slice(0, invPage * PAGE_SIZE).map(item => (
                                <View key={item.id} style={styles.inventoryCard}>
                                    <View style={styles.cardHeaderRow}>
                                        <View>
                                            <Text style={styles.cardTitle}>#{item.id}</Text>
                                            <Text style={styles.cardSub}>Donor: {item.donorName || 'N/A'}</Text>
                                        </View>
                                        <Text style={styles.bloodTypeBig}>{item.bloodType}</Text>
                                    </View>
                                    <View style={{flexDirection: 'row', gap: 6}}>
                                        <View style={[styles.badge, {backgroundColor: '#F1F5F9'}]}>
                                            <Text style={styles.badgeText}>{(item.status || 'AVAILABLE').toUpperCase()}</Text>
                                        </View>
                                        <View style={[styles.badge, {backgroundColor: item.safetyFlag === 'SAFE' ? '#DCFCE7' : (item.safetyFlag === 'BIO-HAZARD' ? '#FEE2E2' : '#FEF3C7')}]}>
                                            <Text style={[styles.badgeText, {color: item.safetyFlag === 'SAFE' ? '#065F46' : (item.safetyFlag === 'BIO-HAZARD' ? '#991B1B' : '#92400E')}]}>
                                                {item.safetyFlag || 'PENDING'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                            {inventoryActive.length === 0 && <Text style={styles.emptyText}>No inventory matches filters.</Text>}
                            {invPage * PAGE_SIZE < inventoryActive.length && (
                                <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setInvPage(p => p+1)}>
                                    <Text style={styles.loadMoreText}>Show More Data ({inventoryActive.length - invPage * PAGE_SIZE} remaining)</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F4FF' },
    header: { backgroundColor: '#FFFFFF', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    backText: { color: '#64748B', fontWeight: 'bold', marginBottom: 8 },
    pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E293B' },
    
    segmentControl: { backgroundColor: '#FFF', paddingVertical: 10, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: '#E2E8F0' },
    segmentBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', marginRight: 10 },
    segActive: { backgroundColor: '#E11D48', borderColor: '#E11D48' },
    segText: { fontWeight: 'bold', color: '#64748B' },
    segTextActive: { fontWeight: 'bold', color: '#FFF' },

    content: { padding: 20 },
    sectionHeader: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 12 },
    emptyText: { color: '#64748B', textAlign: 'center', marginTop: 20 },

    searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, marginBottom: 16 },
    searchInp: { flex: 1, height: 40, marginLeft: 8 },

    filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD5E1', marginRight: 8 },
    filterPillActive: { backgroundColor: '#334155', borderColor: '#334155' },
    filterText: { fontSize: 12, fontWeight: 'bold', color: '#475569' },
    filterTextActive: { fontSize: 12, fontWeight: 'bold', color: '#FFF' },

    card: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 },
    cardTitle: { fontWeight: 'bold', fontSize: 15, color: '#1E293B', flex: 1 },
    cardSub: { fontSize: 12, color: '#64748B' },
    
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
    badgeCrit: { backgroundColor: '#FEE2E2' },
    badgeNorm: { backgroundColor: '#EFF6FF' },
    badgeText: { fontSize: 11, fontWeight: 'bold', color: '#475569' },
    cardBodyText: { fontSize: 13, color: '#475569', marginBottom: 4, flexWrap: 'wrap' },
    reasonText: { fontSize: 13, color: '#64748B', fontStyle: 'italic', marginBottom: 12, flexWrap: 'wrap' },

    dispatchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    dispatchInput: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, width: 60, paddingHorizontal: 10, height: 40, backgroundColor: '#F8FAFC' },
    dispatchBtn: { flex: 1, backgroundColor: '#2563EB', height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8, minWidth: 120 },
    dispatchBtnText: { color: '#FFF', fontWeight: 'bold' },
    warningText: { color: '#B91C1C', fontSize: 12 },

    inventoryCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    bloodTypeBig: { fontSize: 20, fontWeight: 'bold', color: '#E11D48', marginLeft: 'auto' },

    analyticsBox: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    analyticCard: { padding: 10, borderRadius: 10, borderWidth: 1, minWidth: 100, marginRight: 10 },
    aBt: { fontSize: 18, fontWeight: 'bold' },
    aUnits: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
    aLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    aLabel: { fontSize: 10, fontWeight: 'bold' },

    loadMoreBtn: { padding: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, alignItems: 'center', marginTop: 6, marginBottom: 20 },
    loadMoreText: { fontWeight: 'bold', color: '#475569' }
});
