import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Heart, Search, RefreshCw, User, MapPin, Droplet, AlertTriangle } from 'lucide-react-native';

const PAGE_SIZE = 10;

export default function DonorsScreen({ navigation }) {
    const { isAdmin, user } = useAuth();
    
    const [donors, setDonors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    
    // Search and Pagination
    const [searchText, setSearchText] = useState('');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const fetchDonors = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            console.log('Fetching donors, isAdmin:', isAdmin, 'Role:', user?.role);
            let res;
            try {
                res = await api.get('/api/admin/donors');
            } catch (primaryErr) {
                if (primaryErr?.response?.status !== 404) {
                    throw primaryErr;
                }
                res = await api.get('/api/donors/all');
            }
            setDonors(res.data || []);
        } catch (err) {
            console.warn('Unable to load donors:', err?.response?.status, err?.message);
            const msg = err?.response?.data?.message || err?.message || 'Failed to fetch donor list';
            setErrorMsg(msg);
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDonors();
    }, []);

    const filteredDonors = donors.filter(d => {
        const s = searchText.toLowerCase();
        const user = d.user || {};
        return (
            (user.name || '').toLowerCase().includes(s) ||
            (user.email || '').toLowerCase().includes(s) ||
            (d.bloodType || '').toLowerCase().includes(s) ||
            (d.district || '').toLowerCase().includes(s) ||
            (d.province || '').toLowerCase().includes(s)
        );
    });

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={{marginTop: 10, color: '#64748B'}}>Loading donors...</Text>
            </View>
        );
    }

    if (errorMsg) {
        return (
            <View style={styles.centerContainer}>
                <AlertTriangle size={48} color="#DC2626" />
                <Text style={styles.unauthText}>Unable to load donors</Text>
                <Text style={{marginTop: 5, color: '#64748B', textAlign: 'center', paddingHorizontal: 30}}>{errorMsg}</Text>
                <TouchableOpacity onPress={fetchDonors} style={{marginTop: 20, backgroundColor: '#10B981', padding: 12, borderRadius: 8}}>
                    <Text style={{color: '#FFF', fontWeight: 'bold'}}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('AdminDashboard')} style={{marginTop: 15}}>
                    <Text style={{color: '#7C3AED', fontWeight: 'bold'}}>Return to Dashboard</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const visibleDonors = filteredDonors.slice(0, visibleCount);

    if (!isAdmin) {
        return (
            <View style={styles.centerContainer}>
                <Heart size={48} color="#DC2626" />
                <Text style={styles.unauthText}>Access Restricted</Text>
                <Text style={{marginTop: 5, color: '#64748B'}}>You need Admin privileges to view this page.</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AdminDashboard')} style={{marginTop: 20}}>
                    <Text style={{color: '#7C3AED', fontWeight: 'bold'}}>Return to Dashboard</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.navigate('AdminDashboard')}>
                        <Text style={styles.backText}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={fetchDonors} style={styles.refreshBtn}>
                        <RefreshCw size={16} color="#10B981" />
                        <Text style={styles.refreshText}>Refresh</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.titleRow}>
                    <Heart size={24} color="#1E293B" style={{marginRight: 8}} />
                    <Text style={styles.pageTitle}>Donor Directory</Text>
                </View>
                <Text style={styles.subtitle}>View and manage registered donors</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.searchContainer}>
                    <Search size={20} color="#94A3B8" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name, email, blood type, location..."
                        value={searchText}
                        onChangeText={text => { setSearchText(text); setVisibleCount(PAGE_SIZE); }}
                    />
                </View>

                <Text style={styles.listTitle}>Registered Donors ({filteredDonors.length})</Text>

                {visibleDonors.map(d => (
                        <View key={d._id || d.id} style={styles.dCard}>
                            <View style={styles.cardHeader}>
                                <View style={styles.userIconBox}>
                                    <User size={20} color="#10B981" />
                                </View>
                                <View style={styles.userInfo}>
                                    <Text style={styles.userName}>{d.user?.name || d.user?.fullName || 'Unknown Donor'}</Text>
                                    <Text style={styles.userEmail}>{d.user?.email || 'No email contact'}</Text>
                                </View>
                                <View style={styles.bloodBadge}>
                                    <Droplet size={14} color="#E11D48" />
                                    <Text style={styles.bloodTypeText}>{d.bloodType || '??'}</Text>
                                </View>
                            </View>

                            <View style={styles.cardDetails}>
                                <View style={styles.detailItem}>
                                    <MapPin size={14} color="#64748B" />
                                    <Text style={styles.detailText}>
                                        {d.district || 'N/A'}, {d.province || 'N/A'}
                                    </Text>
                                </View>
                            
                                {(d.safetyStatus && d.safetyStatus !== 'SAFE') && (
                                    <View style={[styles.statusBadge, d.safetyStatus === 'POSITIVE' ? styles.statusPos : styles.statusBlock]}>
                                        <AlertTriangle size={12} color={d.safetyStatus === 'POSITIVE' ? '#991B1B' : '#92400E'} />
                                        <Text style={[styles.statusText, {color: d.safetyStatus === 'POSITIVE' ? '#991B1B' : '#92400E'}]}>
                                            {d.safetyStatus}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {d.safetyStatus === 'POSITIVE' && d.positiveReason && (
                                <Text style={styles.reasonText}>Reason: {d.positiveReason}</Text>
                            )}
                        </View>
                    ))
                }

                {filteredDonors.length > visibleCount && (
                    <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setVisibleCount(c => c + PAGE_SIZE)}>
                        <Text style={styles.loadMoreText}>Show More ({filteredDonors.length - visibleCount} remaining)</Text>
                    </TouchableOpacity>
                )}
                
                {!loading && visibleCount > PAGE_SIZE && (
                    <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setVisibleCount(PAGE_SIZE)}>
                        <Text style={styles.loadMoreText}>Show Less</Text>
                    </TouchableOpacity>
                )}
                
                {filteredDonors.length === 0 && !loading && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No donors match your search criteria.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F4FF' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    unauthText: { marginTop: 10, fontSize: 18, fontWeight: 'bold', color: '#1E293B' },

    header: { backgroundColor: '#FFFFFF', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    refreshText: { color: '#10B981', fontWeight: 'bold', fontSize: 13 },
    backText: { color: '#64748B', fontWeight: 'bold' },
    titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E293B' },
    subtitle: { color: '#64748B', fontSize: 13 },

    scroll: { padding: 20, paddingBottom: 40 },
    
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, marginBottom: 20 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, height: 45, fontSize: 15, color: '#1E293B' },

    listTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 12 },

    dCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', elevation: 1 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    userIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    userInfo: { flex: 1 },
    userName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
    userEmail: { fontSize: 13, color: '#64748B' },
    bloodBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF1F2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
    bloodTypeText: { fontSize: 14, fontWeight: 'bold', color: '#E11D48' },

    cardDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    detailText: { fontSize: 13, color: '#64748B' },

    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    statusPos: { backgroundColor: '#FEF2F2' },
    statusBlock: { backgroundColor: '#FFFBEB' },
    statusText: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
    
    reasonText: { marginTop: 8, fontSize: 12, color: '#991B1B', fontStyle: 'italic', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 },

    loadMoreBtn: { padding: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, alignItems: 'center', marginTop: 10 },
    loadMoreText: { color: '#64748B', fontWeight: 'bold', fontSize: 14 },
    
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: '#64748B', fontSize: 15 }
});
