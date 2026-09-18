#define PY_SSIZE_T_CLEAN
#include <Python.h>

static PyObject *get_item_strong(PyObject *self, PyObject *args) {
    (void)self;
    PyObject *mapping;
    PyObject *key;
    if (!PyArg_ParseTuple(args, "OO:get_item_strong", &mapping, &key)) {
        return NULL;
    }

#if PY_VERSION_HEX >= 0x030D0000
    PyObject *value = NULL;
    int found = PyDict_GetItemRef(mapping, key, &value);
    if (found < 0) {
        return NULL;
    }
    if (found == 0) {
        Py_RETURN_NONE;
    }
    return value;
#else
    PyObject *value = PyDict_GetItemWithError(mapping, key);
    if (value == NULL) {
        if (PyErr_Occurred()) {
            return NULL;
        }
        Py_RETURN_NONE;
    }
    Py_INCREF(value);
    return value;
#endif
}

static PyMethodDef methods[] = {
    {"get_item_strong", get_item_strong, METH_VARARGS,
     "Return a strong reference to a dict value, or None when absent."},
    {NULL, NULL, 0, NULL}
};

static struct PyModuleDef module = {
    .m_base = PyModuleDef_HEAD_INIT,
    .m_name = "refsafe",
    .m_doc = "Borrowed-to-strong reference example.",
    .m_size = -1,
    .m_methods = methods,
};

PyMODINIT_FUNC PyInit_refsafe(void) {
    PyObject *m = PyModule_Create(&module);
#ifdef Py_GIL_DISABLED
    if (m == NULL) {
        return NULL;
    }
    if (PyUnstable_Module_SetGIL(m, Py_MOD_GIL_NOT_USED) < 0) {
        Py_DECREF(m);
        return NULL;
    }
#endif
    return m;
}
