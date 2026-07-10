import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

export const useCrud = (service) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const serviceRef = useRef(service);
  serviceRef.current = service;

  const fetchAll = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await serviceRef.current.getAll(params);
      setData(res.data.data || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  const create = async (formData) => {
    const res = await serviceRef.current.create(formData);
    toast.success('Created successfully');
    return res.data.data;
  };

  const update = async (id, formData) => {
    const res = await serviceRef.current.update(id, formData);
    toast.success('Updated successfully');
    return res.data.data;
  };

  const remove = async (id) => {
    await serviceRef.current.delete(id);
    toast.success('Deleted successfully');
  };

  return { data, loading, total, pages, fetchAll, create, update, remove };
};
